describe("Test upload dataset form", () => {
  beforeEach(() => {
    cy.visit("http://localhost:5001/materials/discovery");
  });

  it("File upload works", () => {
    cy.get("input[type=file]").last().selectFile("examples/MaterialsDiscoveryExampleData.csv");
    cy.findByText("Upload dataset").click();
    cy.checkGeneratedContent(
      [
        "MaterialsDiscoveryExampleData.csv",
        "Idx_Sample",
        "SiO2",
        "CaO",
        "SO3",
        "FA (kg/m3)",
        "GGBFS (kg/m3)",
        "Coarse aggregate (kg/m3)",
        "Fine aggregate (kg/m3)",
        "Total aggregates",
        "Na2SiO3",
        "Na2O (Dry)",
        "Sio2 (Dry)",
        "Superplasticizer",
        "water -eff",
        "Slump - Target (mm)",
        "CO2 (kg/t) - A-priori Information",
        "fc 28-d - Target (MPa)",
      ],
      false
    );
  });

  it("Delete dataset works", () => {
    cy.get("input[type=file]").last().selectFile("examples/MaterialsDiscoveryExampleData.csv");
    cy.findByText("Upload dataset").click();
    cy.get(".btn-group > div > button").eq(0).click();
    // Wait for the modal animation to finish
    cy.wait(400);
    cy.findAllByText("Confirm").filter(':visible').click();
    cy.findByText("MaterialsDiscoveryExampleData.csv").should("not.exist");
  });

  it("Select dataset works", () => {
    cy.get("input[type=file]").last().selectFile("examples/MaterialsDiscoveryExampleData.csv");
    cy.findByText("Upload dataset").click();
    cy.get(".btn-group > div > a").eq(0).click();
    cy.url().should("eq", "http://localhost:5001/materials/discovery/MaterialsDiscoveryExampleData.csv");
  });
});

describe("Test running experiments with example dataset", () => {
  beforeEach(() => {
    cy.visit("http://localhost:5001/materials/discovery");
    cy.get("input[type=file]").last().selectFile("examples/MaterialsDiscoveryExampleData.csv");
    cy.findByText("Upload dataset").click();
    cy.get(".btn-group > div > a").eq(0).click();
    cy.url().should("eq", "http://localhost:5001/materials/discovery/MaterialsDiscoveryExampleData.csv");
  });

  it("One target property and one a priori information minimized works", () => {
    // Select features
    cy.findByLabelText("Materials Data (Input) (select one column at least)").select([
      "SiO2",
      "CaO",
      "SO3",
      "FA (kg/m3)",
      "GGBFS (kg/m3)",
      "Coarse aggregate (kg/m3)",
      "Fine aggregate (kg/m3)",
      "Total aggregates",
      "Na2SiO3",
      "Na2O (Dry)",
      "Sio2 (Dry)",
      "Superplasticizer",
      "water -eff",
    ]);

    // Select target properties
    cy.selectInputWaitForAsyncRequest(
      "Target Properties (select one column at least)",
      ["fc 28-d - Target (MPa)"],
      "materials/discovery/create_target_configuration_form"
    );

    // Check that a form appeared
    cy.findAllByLabelText("Maximize").should("have.length", 1);
    cy.findAllByLabelText("Minimize").should("have.length", 1);
    cy.findAllByLabelText("Weight").should("have.length", 1);
    cy.findAllByLabelText("Threshold").should("have.length", 1);

    // Select a priori information
    cy.selectInputWaitForAsyncRequest(
      "A priori Information (optional)",
      ["CO2 (kg/t) - A-priori Information"],
      "materials/discovery/create_a_priori_information_configuration_form"
    );

    // Check that a second form appeared
    cy.findAllByLabelText("Maximize").should("have.length", 2);
    cy.findAllByLabelText("Minimize").should("have.length", 2);
    cy.findAllByLabelText("Weight").should("have.length", 2);
    cy.findAllByLabelText("Threshold").should("have.length", 2);

    // Minimize CO2
    cy.findAllByLabelText("Minimize").eq(1).check();

    // Run the experiment, wait for the request to complete
    cy.clickButtonWaitForAsyncRequest(
      "Run experiment with given configuration",
      "materials/discovery/MaterialsDiscoveryExampleData.csv"
    );
    cy.get(".spinner-border").should("not.exist");

    // Check the first three rows for the columns
    // [Row number, Utility, Novelty, fc 28-d - Target (MPa), Uncertainty (fc 28-d - Target (MPa)), CO2 (kg/t) - A-priori Information]
    cy.get(".table-responsive")
      .eq(1)
      .within(() => {
        cy.checkGeneratedTable([
          [1, 3.617443, 0.224525, 64.10796, 1.71396, 116.12407],
          [2, 3.616378, 0.224525, 64.099414, 1.71567, 116.12407],
          [3, 2.922769, 0.186415, 60.210632, 1.66445, 119.06558],
        ]);
      });
  });

  it("Two target properties and one a priori information minimized with threshold works", () => {
    // Select features
    cy.findByLabelText("Materials Data (Input) (select one column at least)").select([
      "SiO2",
      "CaO",
      "SO3",
      "FA (kg/m3)",
      "GGBFS (kg/m3)",
      "Coarse aggregate (kg/m3)",
      "Fine aggregate (kg/m3)",
      "Total aggregates",
      "Na2SiO3",
      "Na2O (Dry)",
      "Sio2 (Dry)",
      "Superplasticizer",
      "water -eff",
    ]);

    // Select target properties
    cy.selectInputWaitForAsyncRequest(
      "Target Properties (select one column at least)",
      ["fc 28-d - Target (MPa)", "Slump - Target (mm)"],
      "materials/discovery/create_target_configuration_form"
    );

    // Select a priori information
    cy.selectInputWaitForAsyncRequest(
      "A priori Information (optional)",
      ["CO2 (kg/t) - A-priori Information"],
      "materials/discovery/create_a_priori_information_configuration_form"
    );

    // Minimize CO2 and set threshold
    cy.findAllByLabelText("Minimize").eq(2).check();
    cy.findAllByLabelText("Threshold").eq(2).type(120).should("have.value", 120);

    // Run the experiment, wait for the request to complete
    cy.clickButtonWaitForAsyncRequest(
      "Run experiment with given configuration",
      "materials/discovery/MaterialsDiscoveryExampleData.csv"
    );
    cy.get(".spinner-border").should("not.exist");

    // Check the first three rows for the columns
    // [Row number, Utility, Novelty, fc 28-d - Target (MPa), Slump - Target (mm),
    //  Uncertainty (Slump - Target (mm)), Uncertainty (fc 28-d - Target (MPa)), CO2 (kg/t) - A-priori Information]
    cy.get(".table-responsive")
      .eq(1)
      .within(() => {
        cy.checkGeneratedTable([
          [1, 4.829715, 0.807661, 181.669628, 64.10796, 8.29994, 1.71396, 116.12407],
          [2, 4.826005, 0.807658, 181.588483, 64.099414, 8.30358, 1.71567, 116.12407],
          [3, 3.149575, 1.0, 151.522781, 57.296066, 22.57863, 4.27784, 114.39607],
        ]);
      });
  });
});
