from slamd.common.common_validators import min_max_increment_config_valid
from slamd.common.error_handling import ValueNotSupportedException, SlamdRequestTooLargeException
from slamd.common.slamd_utils import not_numeric, not_empty, empty
from slamd.formulations.processing.forms.formulations_min_max_form import FormulationsMinMaxForm
from slamd.formulations.processing.forms.materials_and_processes_selection_form import \
    MaterialsAndProcessesSelectionForm
from slamd.formulations.processing.forms.weights_form import WeightsForm
from slamd.formulations.processing.formulations_converter import FormulationsConverter
from slamd.formulations.processing.formulations_dto import FormulationsDto
from slamd.formulations.processing.formulations_persistence import FormulationsPersistence
from slamd.formulations.processing.weight_input_preprocessor import WeightInputPreprocessor
from slamd.formulations.processing.weights_calculator import WeightsCalculator
from slamd.materials.processing.materials_facade import MaterialsFacade

WEIGHT_FORM_DELIMITER = '/'
MAX_NUMBER_OF_WEIGHTS = 10000


class FormulationsService:

    @classmethod
    def populate_selection_form(cls):
        all_materials = MaterialsFacade.find_all()

        form = MaterialsAndProcessesSelectionForm()
        form.powder_selection.choices = cls._to_selection(all_materials.powders)
        form.liquid_selection.choices = cls._to_selection(all_materials.liquids)
        form.aggregates_selection.choices = cls._to_selection(all_materials.aggregates_list)
        form.admixture_selection.choices = cls._to_selection(all_materials.admixtures)
        form.custom_selection.choices = cls._to_selection(all_materials.customs)
        form.process_selection.choices = cls._to_selection(all_materials.processes)

        return form

    @classmethod
    def _to_selection(cls, list_of_models):
        by_name = sorted(list_of_models, key=lambda model: model.name)
        by_type = sorted(by_name, key=lambda model: model.type)
        return list(map(lambda material: (f'{material.type}|{str(material.uuid)}', f'{material.name}'), by_type))

    @classmethod
    def create_formulations_min_max_form(cls, formulation_selection):
        powder_names = [item['name'] for item in formulation_selection if item['type'] == 'Powder']
        liquid_names = [item['name'] for item in formulation_selection if item['type'] == 'Liquid']
        aggregates_names = [item['name'] for item in formulation_selection if item['type'] == 'Aggregates']

        powder_uuids = [item['uuid'] for item in formulation_selection if item['type'] == 'Powder']
        liquid_uuids = [item['uuid'] for item in formulation_selection if item['type'] == 'Liquid']
        aggregates_uuids = [item['uuid'] for item in formulation_selection if item['type'] == 'Aggregates']

        # TODO: properly handle cases where e.g. no aggregates are specified
        if len(powder_names) == 0 or len(liquid_names) == 0 or len(aggregates_names) == 0:
            raise ValueNotSupportedException('You need to specify powders, liquids and aggregates')

        min_max_form = FormulationsMinMaxForm()

        cls._create_min_max_form_entry(min_max_form.materials_min_max_entries, ','.join(powder_uuids),
                                       'Powders ({0})'.format(', '.join(powder_names)), 'Powder')
        cls._create_min_max_form_entry(min_max_form.materials_min_max_entries, ','.join(liquid_uuids),
                                       'Liquids ({0})'.format(', '.join(liquid_names)), 'Liquid')
        cls._create_min_max_form_entry(min_max_form.materials_min_max_entries, ','.join(aggregates_uuids),
                                       'Aggregates ({0})'.format(', '.join(aggregates_names)), 'Aggregates')

        cls._create_non_editable_entries(formulation_selection, min_max_form, 'Admixture')
        cls._create_non_editable_entries(formulation_selection, min_max_form, 'Custom')
        cls._create_non_editable_entries(formulation_selection, min_max_form, 'Process')

        return min_max_form

    @classmethod
    def _create_non_editable_entries(cls, formulation_selection, min_max_form, type):
        selection_for_type = [item for item in formulation_selection if item['type'] == type]
        for item in selection_for_type:
            cls._create_min_max_form_entry(min_max_form.non_editable_entries, item['uuid'], item['name'], type)

    @classmethod
    def _create_min_max_form_entry(cls, entries, uuids, name, type):
        entry = entries.append_entry()
        entry.materials_entry_name.data = name
        entry.uuid_field.data = uuids
        entry.type_field.data = type
        if type == 'Powder' or type == 'Liquid' or type == 'Aggregates':
            entry.increment.name = type
            entry.min.name = type
            entry.max.name = type
        if type == 'Aggregates':
            entry.increment.render_kw = {'disabled': 'disabled'}
            entry.min.render_kw = {'disabled': 'disabled'}
            entry.max.render_kw = {'disabled': 'disabled'}

    @classmethod
    def create_weights_form(cls, weights_request_data):
        materials_formulation_config = weights_request_data['materials_formulation_configuration']
        weight_constraint = weights_request_data['weight_constraint']

        # the result of the computation contains a list of lists with each containing the weights in terms of the
        # various materials used for blending; for example full_cartesian_product =
        # "[['18.2', '15.2', '66.6'], ['18.2', '20.3', '61.5'], ['28.7', '15.2', '56.1']]"
        if empty(weight_constraint):
            raise ValueNotSupportedException('You must set a non-empty weight constraint!')
        else:
            full_cartesian_product = cls._get_constrained_weights(materials_formulation_config, weight_constraint)
        if len(full_cartesian_product) > MAX_NUMBER_OF_WEIGHTS:
            raise SlamdRequestTooLargeException(
                f'Too many weights were requested. At most {MAX_NUMBER_OF_WEIGHTS} weights can be created!')

        weights_form = WeightsForm()
        for i, entry in enumerate(full_cartesian_product):
            ratio_form_entry = weights_form.all_weights_entries.append_entry()
            ratio_form_entry.weights.data = WEIGHT_FORM_DELIMITER.join(entry)
            ratio_form_entry.idx.data = str(i)
        return weights_form

    @classmethod
    def _get_constrained_weights(cls, formulation_config, weight_constraint):
        if not_numeric(weight_constraint):
            raise ValueNotSupportedException('Weight Constraint must be a number!')
        if not min_max_increment_config_valid(formulation_config, weight_constraint):
            raise ValueNotSupportedException('Configuration of weights is not valid!')

        all_materials_weights = WeightInputPreprocessor.collect_weights(formulation_config)

        return WeightsCalculator.compute_full_cartesian_product(all_materials_weights, weight_constraint)

    # TODO: Implement constraint case / validate pattern of targets / move creation of dto to converter
    @classmethod
    def create_materials_formulations(cls, formulations_data):
        materials_data = formulations_data['materials_request_data']['materials_formulation_configuration']
        weight_constraint = formulations_data['materials_request_data']['weight_constraint']
        processes_data = formulations_data['processes_request_data']['processes']
        targets = formulations_data['targets']

        all_weights = []
        if empty(weight_constraint):
            all_weights = WeightInputPreprocessor.collect_weights_for_creation_of_formulation_batch(materials_data)
        weight_product = WeightsCalculator.compute_cartesian_product(all_weights)

        materials = []
        for material_data in materials_data:
            materials.append(MaterialsFacade.get_material(material_data['type'], material_data['uuid']))

        processes = []
        for process in processes_data:
            processes.append(MaterialsFacade.get_process(process['uuid']))

        dataframe = FormulationsConverter.formulation_to_df(materials, processes, weight_product, targets)
        FormulationsPersistence.save(dataframe)

        as_dict = dataframe.transpose().to_dict()

        all_dtos = []
        for key, inner_dict in as_dict.items():
            properties = cls._create_properties(inner_dict, targets)
            target_list = cls._create_targets(inner_dict, targets)
            dto = FormulationsDto(properties=properties, targets=target_list)
            all_dtos.append(dto)
        return dataframe, all_dtos, targets.split(';')

    @classmethod
    def _create_properties(cls, inner_dict, targets):
        properties = ''
        target_list = targets.split(';')
        properties_dict = {k: v for k, v in inner_dict.items() if k not in target_list}
        for key, value in properties_dict.items():
            properties += f'{key}: {value}; '
        properties = properties.strip()[:-1]
        return properties

    @classmethod
    def _create_targets(cls, inner_dict, targets):
        targets_as_dto = []
        target_list = targets.split(';')
        target_dict = {k: v for k, v in inner_dict.items() if k in target_list}
        for key, value in target_dict.items():
            targets_as_dto.append(value)
        return targets_as_dto
