const BLENDED_MATERIALS_URL = `${window.location.protocol}//${window.location.host}/materials/blended`

let allSelectedOptions = []

/**
 * When changing the base material type, we dynamically replace the multiselect input field. As a consequence, the change event
 * related to choosing from this selection must be reattached to it.
 */
async function selectBaseMaterialType() {
    document.getElementById("base_material_selection").removeEventListener("change", createFieldsForSelectedBaseMaterial)

    const elem = document.getElementById("base_type");
    const url = `${BLENDED_MATERIALS_URL}/${elem.value.toLowerCase()}`;
    await fetchEmbedTemplateInPlaceholder(url, "base-material-selection-placeholder");

    document.getElementById("base_material_selection").addEventListener("change", createFieldsForSelectedBaseMaterial)
}

async function createFieldsForSelectedBaseMaterial(event) {
    let userInputs = collectMinMaxInputs(event)

    for (let option of allSelectedOptions) {
        console.log(option.innerHTML)
    }
    let selectedIndex = event.target.options.selectedIndex;
    let clicked_material = event.target.options[selectedIndex];


    const placeholder = document.getElementById("min-max-placeholder");

    const url = `${BLENDED_MATERIALS_URL}/add_min_max_entry/${selectedIndex}`;
    await fetchEmbedTemplateInPlaceholder(url, "min-max-placeholder", true);

    document.getElementById(`min-max-properties-${selectedIndex}-name`).value = clicked_material.innerHTML;
    restoreAdditionalProperties(userInputs)
}

function collectMinMaxInputs(event) {
    usersInputs = [];

    let options = event.target.options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].selected && i !== options.selectedIndex) {
            let name = document.getElementById(`min-max-properties-${i}-name`).value;
            let min = document.getElementById(`min-max-properties-${i}-min`).value;
            let max = document.getElementById(`min-max-properties-${i}-max`).value;

            usersInputs.push({
                name: name,
                min: min,
                max: max
            });
        }
    }
    return usersInputs;
}

function restoreAdditionalProperties(usersInputs) {
    for (let i = 0; i < usersInputs.length; i++) {
        document.getElementById(`min-max-properties-${i}-name`).value = usersInputs[i].name;
        document.getElementById(`min-max-properties-${i}-min`).value = usersInputs[i].min;
        document.getElementById(`min-max-properties-${i}-max`).value = usersInputs[i].max;
    }
}

window.addEventListener("load", function () {
    document.getElementById("base_type").addEventListener("change", selectBaseMaterialType)
    document.getElementById("base_material_selection").addEventListener("change", createFieldsForSelectedBaseMaterial)
});
