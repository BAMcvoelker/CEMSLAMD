let nameIsEmpty = true;

/**
 * When changing the base material type, we dynamically replace the multiselect input field. As a consequence, the change event
 * related to choosing from this selection must be reattached to it. Further, for consistency, former min-max fields are reset
 */
async function selectBaseMaterialType() {
  removeInnerHtmlFromPlaceholder("min-max-placeholder");
  removeInnerHtmlFromPlaceholder("blending-ratio-placeholder");
  document.getElementById("change-base-material-selection-button").disabled = true;

  const elem = document.getElementById("base_type");
  const url = `${BLENDED_MATERIALS_URL}/${elem.value.toLowerCase()}`;
  await fetchDataAndEmbedTemplateInPlaceholder(url, "base-material-selection-placeholder");

  document.getElementById("base_material_selection").addEventListener("change", toggleConfirmationButton);
}

async function confirmSelection() {
  removeInnerHtmlFromPlaceholder("min-max-placeholder");
  removeInnerHtmlFromPlaceholder("blending-ratio-placeholder");

  const placeholder = document.getElementById("base_material_selection");

  const selectedMaterials = collectSelection(placeholder);
  let uuids = selectedMaterials.map((material) => material.uuid);

  const type = document.getElementById("base_type").value;

  const url = `${BLENDED_MATERIALS_URL}/add_min_max_entries/${type.toLowerCase()}/${selectedMaterials.length}`;
  await postDataAndEmbedTemplateInPlaceholder(url, "min-max-placeholder", uuids);

  prepareMinMaxInputFieldsFromSelection(selectedMaterials);
  assignKeyboardEventsToMinMaxForm();
  assignConfirmBlendingConfigurationEvent();
}

async function assignConfirmBlendingConfigurationEvent() {
  const elem = document.getElementById("confirm-blending-configuration-button");
  enableTooltip(elem);

  elem.addEventListener("click", async () => {
    const minMaxValuesWithIncrements = collectMinMaxValuesWithIncrements();
    const url = `${BLENDED_MATERIALS_URL}/add_ratios`;
    await postDataAndEmbedTemplateInPlaceholder(url, "blending-ratio-placeholder", minMaxValuesWithIncrements);
    assignKeyboardEventsToRatiosForm(true);
    assignAddCustomBlendEvent();
    assignDeleteCustomBlendEvent();
  });
}

function toggleConfirmationButton() {
  const count = countSelectedOptionsMultipleSelectField(document.getElementById("base_material_selection"));
  document.getElementById("change-base-material-selection-button").disabled = count < 2;
}

function checkNameIsNotEmpty() {
  let nameField = document.getElementById("blended_material_name");
  nameIsEmpty = nameField.value === undefined || nameField.value === "";
  document.getElementById("submit").disabled = nameIsEmpty || !allRatioFieldsHaveValidInput;
}

async function deleteMaterial(id, material_type) {
  deleteMaterialByType(id, material_type, true);
}

window.addEventListener("load", function () {
  document.getElementById("nav-bar-blended").setAttribute("class", "nav-link active");
  document.getElementById("base_type").addEventListener("change", selectBaseMaterialType);
  document.getElementById("base_material_selection").addEventListener("change", toggleConfirmationButton);
  document.getElementById("blended_material_name").addEventListener("change", checkNameIsNotEmpty);
});