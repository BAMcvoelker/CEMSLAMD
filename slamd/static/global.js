const ACTION_BUTTON_DELIMITER = "___";
const MORE_THAN_TWO_DECIMAL_PLACES = /^\d*[.,]\d{3,}$/;

function roundInputFieldValueToTwoDecimalPlaces(inputFieldElem) {
  if (MORE_THAN_TWO_DECIMAL_PLACES.test(inputFieldElem.value)) {
    inputFieldElem.value = parseFloat(inputFieldElem.value).toFixed(2);
  }
}

function clipMinInputFieldValue(inputFieldElem, minValue) {
  if (typeof minValue !== "number" || isNaN(minValue) || !isFinite(minValue)) {
    return;
  }
  if (parseFloat(inputFieldElem.value) < minValue) {
    inputFieldElem.value = minValue;
  }
}

function clipMaxInputFieldValue(inputFieldElem, maxValue) {
  if (typeof maxValue !== "number" || isNaN(maxValue) || !isFinite(maxValue)) {
    return;
  }
  if (parseFloat(inputFieldElem.value) > maxValue) {
    inputFieldElem.value = maxValue;
  }
}

function correctInputFieldValue(inputFieldElem, minValue, maxValue) {
  roundInputFieldValueToTwoDecimalPlaces(inputFieldElem);
  clipMinInputFieldValue(inputFieldElem, minValue);
  clipMaxInputFieldValue(inputFieldElem, maxValue);
}

async function fetchDataAndEmbedTemplateInPlaceholder(url, placeholderID, append = false) {
  const response = await fetch(url);
  if (response.ok) {
    const form = await response.json();
    if (append) {
      document.getElementById(placeholderID).innerHTML += form["template"];
    } else {
      document.getElementById(placeholderID).innerHTML = form["template"];
    }
  } else {
    const error = await response.text();
    document.write(error);
  }
}

async function postDataAndEmbedTemplateInPlaceholder(url, placeholderID, body) {
  const token = document.getElementById("csrf_token").value;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-CSRF-TOKEN": token,
    },
    body: JSON.stringify(body),
  });
  if (response.ok) {
    const form = await response.json();
    document.getElementById(placeholderID).innerHTML = form["template"];
  } else {
    const error = await response.text();
    document.write(error);
  }
}

async function deleteDataAndEmbedTemplateInPlaceholder(url, placeholderID) {
  const token = document.getElementById("csrf_token").value;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "X-CSRF-TOKEN": token,
    },
  });
  if (response.ok) {
    const form = await response.json();
    document.getElementById(placeholderID).innerHTML = form["template"];
  } else {
    const error = await response.text();
    document.write(error);
  }
}

function removeInnerHtmlFromPlaceholder(placeholderID) {
  let placeholder = document.getElementById(placeholderID);
  placeholder.innerHTML = "";
}

function collectSelection(placeholder) {
  return Array.from(placeholder.children)
    .filter((option) => option.selected)
    .map((option) => {
      return {
        uuid: option.value,
        name: option.innerHTML,
      };
    });
}

function atLeastOneItemIsSelected(placeholder) {
  const selectedItems = Array.from(placeholder.children)
      .filter((option) => option.selected);
  return selectedItems.length > 0;
}

function enableTooltip(elem) {
  return new bootstrap.Tooltip(elem, { trigger: "hover" });
}

/**
 * Enable tooltips everywhere
 * See Bootstrap docs: https://getbootstrap.com/docs/5.0/components/tooltips/#example-enable-tooltips-everywhere
 */
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl, { trigger: "hover" });
});

function setNavBarHomeToActive() {
  if (window.location.pathname === "/") {
    document.getElementById("nav-bar-home").setAttribute("class", "nav-link active");
  }
}

window.addEventListener("load", function () {
  setNavBarHomeToActive();
});
