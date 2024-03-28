import { assignClickEventToSubmitButton } from "./utils.js"
import { assignEventsToFormulation } from "./formulation.js";

export function assignEventsToDesignKnowledgeForm() {
    assignClickEventToSubmitButton("generate_design_knowledge_button", handleGeneratingDesignKnowledge)
    assignClickEventToSubmitButton("continue_design_knowledge_button", handleGeneratingFormulation)
}

async function handleGeneratingDesignKnowledge(){
    insertSpinnerInPlaceholder("design_knowledge_inner_container",true,CHATBOT_RESPONSE_SPINNER);
    setTimeout(async function handleSubmission() {
        await postDataAndEmbedTemplateInPlaceholder(
            "/design_assistant/zero_shot/generate_design_knowledge",
            "design_knowledge",
            {"token": document.getElementById("token_form-token").value}
        );
        removeSpinnerInPlaceholder("design_knowledge_inner_container", CHATBOT_RESPONSE_SPINNER)
        document.getElementById("design_knowledge").classList.remove('d-none')
    }, 1000);
    document.getElementById("continue_design_knowledge_button").disabled = false

}

async function handleGeneratingFormulation(){
    const design_knowledge = document.getElementById("design_knowledge").innerHTML
    const formulation_chat_message_container = document.getElementById("formulation_chat_message_container")
    if (!formulation_chat_message_container) {
        insertSpinnerInPlaceholder("formulation_container", true, CHATBOT_RESPONSE_SPINNER);
    }
    else {
        insertSpinnerInPlaceholder("formulation", false, CHATBOT_RESPONSE_SPINNER);
    }
    setTimeout(async function handleSubmission() {
        await postDataAndEmbedTemplateInPlaceholder(
            "/design_assistant/zero_shot/generate_formulation",
            "formulation_container",
            {"design_knowledge" : design_knowledge ,"token": document.getElementById("token_form-token").value}
        );
        removeSpinnerInPlaceholder("formulation_container", CHATBOT_RESPONSE_SPINNER)
        assignEventsToFormulation()
    }, 1000);
}