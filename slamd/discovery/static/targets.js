const TARGET_BASE_URL = `${window.location.protocol}//${window.location.host}/materials/discovery`;

async function addTarget() {
  const targetName = document.getElementById("target_value").value;
  const dataset = document.getElementById("dataset_to_add_targets_to").innerHTML;
  const url = `${TARGET_BASE_URL}/${dataset}/${targetName}/add_target`;

  await fetchDataAndEmbedTemplateInPlaceholder(url, "targets-placeholder");
  document.getElementById("choose_target_field").addEventListener("change", onChangeTargetToBeLabelled);
}

function toggleShowHideDataframe() {
  const dataframeTable = document.getElementById("dataframe-container");
  dataframeTable.style.display = dataframeTable.style.display === "none" ? "block" : "none";
}

function toggleAddTargetButton() {
  const targetValue = document.getElementById("target_value").value;
  const addTargetButton = document.getElementById("add_target_button");
  addTargetButton.disabled = targetValue === undefined || targetValue === "";
}

async function onChangeTargetToBeLabelled(event) {
  const names = collectSelectedValues(event.target.options);
  const dataset = document.getElementById("dataset_to_add_targets_to").innerHTML;
  const url = `${TARGET_BASE_URL}/${dataset}/toggle_targets`;
  await postDataAndEmbedTemplateInPlaceholder(url, "targets-placeholder", {
    names,
  });
  document.getElementById("choose_target_field").addEventListener("change", onChangeTargetToBeLabelled);
}

function collectSelectedValues(options) {
  const values = [];
  for (const option of options) {
    if (option.selected) {
      values.push(option.value);
    }
  }
  return values;
}

window.addEventListener("load", function () {
  document.getElementById("nav-bar-discovery").setAttribute("class", "nav-link active");
  document.getElementById("add_target_button").addEventListener("click", addTarget);
  document.getElementById("target_value").addEventListener("keyup", toggleAddTargetButton);
  document.getElementById("toggle_dataframe_button").addEventListener("click", toggleShowHideDataframe);
  document.getElementById("choose_target_field").addEventListener("change", onChangeTargetToBeLabelled);
});
