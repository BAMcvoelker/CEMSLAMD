from slamd.common.error_handling import DatasetNotFoundException
from slamd.common.slamd_utils import empty
from slamd.discovery.processing.discovery_persistence import DiscoveryPersistence
from slamd.discovery.processing.forms.upload_dataset_form import UploadDatasetForm
from slamd.discovery.processing.models.dataset import Dataset
from slamd.discovery.processing.strategies.csv_strategy import CsvStrategy


class DiscoveryService:

    @classmethod
    def save_dataset(cls):
        # Flask-WTF handles passing form data to the form for us
        form = UploadDatasetForm()

        if form.validate_on_submit():
            dataset = CsvStrategy.create_dataset(form.dataset.data)
            CsvStrategy.save_dataset(dataset)
            return True, None
        return False, form

    @classmethod
    def list_columns(cls, dataset_name):
        dataset = DiscoveryPersistence.query_dataset_by_name(dataset_name)
        if empty(dataset):
            raise DatasetNotFoundException('Material with given UUID not found')
        return dataset.columns

    @classmethod
    def list_datasets(cls):
        return DiscoveryPersistence.get_session_property()
