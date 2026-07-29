import fs from "fs";
import path from "path";

// Hex ObjectIds mapping for fields
const fieldIds: Record<string, string> = {
  fld_status_project: "6a69d325c0a34f58fe60b001",
  fld_tentative_title: "6a69d325c0a34f58fe60b002",
  fld_logline: "6a69d325c0a34f58fe60b003",
  fld_synopsis: "6a69d325c0a34f58fe60b004",
  fld_genre: "6a69d325c0a34f58fe60b005",
  fld_target_audience: "6a69d325c0a34f58fe60b006",
  fld_contact_info: "6a69d325c0a34f58fe60b007",
  fld_key_technicians: "6a69d325c0a34f58fe60b008",
  fld_list_cast_crew: "6a69d325c0a34f58fe60b009",
  fld_research_completed: "6a69d325c0a34f58fe60b00a",
  fld_time_story_research: "6a69d325c0a34f58fe60b00b",
  fld_time_script_dialogue: "6a69d325c0a34f58fe60b00c",
  fld_cast_crew_wishlist: "6a69d325c0a34f58fe60b00d",
  fld_budget_requirement: "6a69d325c0a34f58fe60b00e",
  fld_amount_spent: "6a69d325c0a34f58fe60b00f",
  fld_reg_doc_basic: "6a69d325c0a34f58fe60b010",
  fld_reg_doc_full: "6a69d325c0a34f58fe60b011",
  fld_mood_sketches: "6a69d325c0a34f58fe60b012",
  fld_mood_sketches_note: "6a69d325c0a34f58fe60b013",
  fld_other_info: "6a69d325c0a34f58fe60b014",
  fld_terms_disclaimer: "6a69d325c0a34f58fe60b015"
};

const statuses = [
  "a) Story Phase",
  "b) Scripting Phase",
  "c) Bound Script is ready",
  "d) Pre-Production",
  "e) Production",
  "f) Post-production",
  "g) Release"
];

// Define show conditions for each field using the prefixed status strings
const fieldShowConditions: Record<string, string[]> = {
  // Always shown fields once any status is selected
  fld_tentative_title: statuses,
  fld_logline: statuses,
  fld_synopsis: statuses,
  fld_genre: statuses,
  fld_target_audience: statuses,
  fld_contact_info: statuses,
  fld_other_info: statuses,
  fld_terms_disclaimer: statuses,

  // Phase-specific fields
  fld_key_technicians: ["a) Story Phase", "b) Scripting Phase", "c) Bound Script is ready"],
  fld_list_cast_crew: ["d) Pre-Production", "e) Production", "f) Post-production", "g) Release"],
  fld_research_completed: ["a) Story Phase"],
  fld_time_story_research: ["a) Story Phase"],
  fld_time_script_dialogue: ["b) Scripting Phase"],
  fld_cast_crew_wishlist: ["c) Bound Script is ready"],
  fld_budget_requirement: ["d) Pre-Production", "e) Production", "f) Post-production", "g) Release"],
  fld_amount_spent: ["e) Production", "f) Post-production", "g) Release"],
  fld_reg_doc_basic: ["a) Story Phase", "b) Scripting Phase"],
  fld_reg_doc_full: ["c) Bound Script is ready", "d) Pre-Production", "e) Production", "f) Post-production", "g) Release"],
  fld_mood_sketches: ["b) Scripting Phase"],
  fld_mood_sketches_note: ["c) Bound Script is ready", "d) Pre-Production", "e) Production", "f) Post-production", "g) Release"]
};

// Generate logicRules for the status field using ObjectIds
const logicRules: any[] = [];
Object.entries(fieldShowConditions).forEach(([fieldKey, activeStatuses]) => {
  const targetFieldId = fieldIds[fieldKey];
  activeStatuses.forEach(status => {
    logicRules.push({
      targetFieldId,
      action: "show",
      operator: "equals",
      value: status,
      condition: {
        fieldId: fieldIds.fld_status_project,
        operator: "equals",
        value: status
      }
    });
  });
});

const formTemplate = {
  title: "To Pitch a Project",
  description: "Form for pitching a project, including details about the project status, questionnaire, and Terms & Conditions acceptance.",
  status: "published",
  pages: [
    {
      id: "page-1",
      order: 0,
      title: "Basic Information",
      description: "Please select the project status to begin."
    },
    {
      id: "page-2",
      order: 1,
      title: "Phase Specifics",
      description: "Please fill out the questionnaire specific to your current project phase."
    },
    {
      id: "page-3",
      order: 2,
      title: "Acceptance",
      description: "Please review and accept the Terms & Conditions and Disclaimer."
    }
  ],
  fields: [
    {
      _id: fieldIds.fld_status_project,
      fieldId: fieldIds.fld_status_project,
      pageId: "page-1",
      label: "Status of Project",
      type: "dropdown",
      required: true,
      placeholder: "Select status...",
      helpText: "Select the current status/phase of your project.",
      options: statuses,
      logicRules: logicRules
    },
    {
      _id: fieldIds.fld_tentative_title,
      fieldId: fieldIds.fld_tentative_title,
      pageId: "page-2",
      label: "Tentative Title",
      type: "short_text",
      required: true,
      placeholder: "e.g. Inception",
      helpText: "Enter the tentative title of the project."
    },
    {
      _id: fieldIds.fld_logline,
      fieldId: fieldIds.fld_logline,
      pageId: "page-2",
      label: "Logline",
      type: "long_text",
      required: true,
      placeholder: "A brief, one-sentence summary of the project...",
      helpText: "Enter the logline of your project."
    },
    {
      _id: fieldIds.fld_synopsis,
      fieldId: fieldIds.fld_synopsis,
      pageId: "page-2",
      label: "Synopsis",
      type: "long_text",
      required: true,
      placeholder: "Detailed summary of the plot, characters, and themes...",
      helpText: "Enter the synopsis of your project."
    },
    {
      _id: fieldIds.fld_genre,
      fieldId: fieldIds.fld_genre,
      pageId: "page-2",
      label: "Genre",
      type: "short_text",
      required: true,
      placeholder: "e.g. Sci-Fi, Thriller",
      helpText: "Enter the genre of your project."
    },
    {
      _id: fieldIds.fld_target_audience,
      fieldId: fieldIds.fld_target_audience,
      pageId: "page-2",
      label: "Target Audience",
      type: "short_text",
      required: true,
      placeholder: "e.g. Young adults, 18-35",
      helpText: "Describe the target audience for this project."
    },
    {
      _id: fieldIds.fld_contact_info,
      fieldId: fieldIds.fld_contact_info,
      pageId: "page-2",
      label: "Your name, contact info, title (writer etc.)",
      type: "long_text",
      required: true,
      placeholder: "e.g. Piyush Prajapat, piyush@example.com, Writer",
      helpText: "Provide your name, contact information, and role/title on this project."
    },
    {
      _id: fieldIds.fld_key_technicians,
      fieldId: fieldIds.fld_key_technicians,
      pageId: "page-2",
      label: "Key Technicians Attached",
      type: "long_text",
      required: true,
      placeholder: "Details of any key technicians attached to the project...",
      helpText: "Provide details of key technicians (director, cinematographer, etc.) attached to the project, if any."
    },
    {
      _id: fieldIds.fld_list_cast_crew,
      fieldId: fieldIds.fld_list_cast_crew,
      pageId: "page-2",
      label: "List of key cast and crew",
      type: "long_text",
      required: true,
      placeholder: "Details of main cast members and crew attached...",
      helpText: "List the main cast and crew members currently attached to the project."
    },
    {
      _id: fieldIds.fld_research_completed,
      fieldId: fieldIds.fld_research_completed,
      pageId: "page-2",
      label: "Is Research completed",
      type: "dropdown",
      required: true,
      placeholder: "Select...",
      helpText: "Indicate whether research for the story is completed.",
      options: ["Yes", "No"]
    },
    {
      _id: fieldIds.fld_time_story_research,
      fieldId: fieldIds.fld_time_story_research,
      pageId: "page-2",
      label: "Time required for completion of Story & Research",
      type: "short_text",
      required: true,
      placeholder: "e.g. 2 months",
      helpText: "Time needed to complete research and the story draft."
    },
    {
      _id: fieldIds.fld_time_script_dialogue,
      fieldId: fieldIds.fld_time_script_dialogue,
      pageId: "page-2",
      label: "Time required for completion of Script with Dialogue draft",
      type: "short_text",
      required: true,
      placeholder: "e.g. 3 months",
      helpText: "Time needed to complete the full script and dialogue draft."
    },
    {
      _id: fieldIds.fld_cast_crew_wishlist,
      fieldId: fieldIds.fld_cast_crew_wishlist,
      pageId: "page-2",
      label: "Cast and Crew Wishlist",
      type: "long_text",
      required: true,
      placeholder: "Wishlist of actors, director, or crew members...",
      helpText: "Enter your ideal cast and crew wishlist for this project."
    },
    {
      _id: fieldIds.fld_budget_requirement,
      fieldId: fieldIds.fld_budget_requirement,
      pageId: "page-2",
      label: "Budget of project and requirement",
      type: "short_text",
      required: true,
      placeholder: "e.g. $500,000, looking for co-producer",
      helpText: "Enter the project's estimated budget and production requirements."
    },
    {
      _id: fieldIds.fld_amount_spent,
      fieldId: fieldIds.fld_amount_spent,
      pageId: "page-2",
      label: "Amount spent till date",
      type: "short_text",
      required: true,
      placeholder: "e.g. $50,000",
      helpText: "Provide details on the budget spent so far."
    },
    {
      _id: fieldIds.fld_reg_doc_basic,
      fieldId: fieldIds.fld_reg_doc_basic,
      pageId: "page-2",
      label: "Registration document of title, logline, synopsis",
      type: "file_upload",
      required: true,
      placeholder: "Upload registration document",
      helpText: "Attach the registration document of the title, logline, and synopsis.",
      maxFileSize: 10,
      allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"]
    },
    {
      _id: fieldIds.fld_reg_doc_full,
      fieldId: fieldIds.fld_reg_doc_full,
      pageId: "page-2",
      label: "Registration document of title, logline, synopsis and script",
      type: "file_upload",
      required: true,
      placeholder: "Upload registration document",
      helpText: "Attach the registration document of the title, logline, synopsis, and script.",
      maxFileSize: 15,
      allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"]
    },
    {
      _id: fieldIds.fld_mood_sketches,
      fieldId: fieldIds.fld_mood_sketches,
      pageId: "page-2",
      label: "Pls attach mood board and key character sketches",
      type: "file_upload",
      required: true,
      placeholder: "Upload mood board & character sketches",
      helpText: "Attach the mood board and key character sketches for this project.",
      maxFileSize: 20,
      allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"]
    },
    {
      _id: fieldIds.fld_mood_sketches_note,
      fieldId: fieldIds.fld_mood_sketches_note,
      pageId: "page-2",
      label: "Pls attach mood board and key character sketches (brief note about character sketches is required)",
      type: "file_upload",
      required: true,
      placeholder: "Upload mood board & sketches (with brief note)",
      helpText: "Attach the mood board and key character sketches. Make sure to include a brief note about the character sketches in the uploaded document.",
      maxFileSize: 25,
      allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"]
    },
    {
      _id: fieldIds.fld_other_info,
      fieldId: fieldIds.fld_other_info,
      pageId: "page-3",
      label: "Any other information that you wish to provide.",
      type: "long_text",
      required: true,
      placeholder: "Type other information here, or 'None' if not applicable...",
      helpText: "Provide any other relevant details or notes about your project pitch."
    },
    {
      _id: fieldIds.fld_terms_disclaimer,
      fieldId: fieldIds.fld_terms_disclaimer,
      pageId: "page-3",
      label: "Acknowledgement & Acceptance of T&C and Disclaimer",
      type: "multiple_choice",
      required: true,
      helpText: "Review the disclaimer and terms of confidential submission before accepting.",
      options: ["I accept the terms and conditions and disclaimer"]
    }
  ],
  settings: {
    honeypotEnabled: true,
    layout: "single_column",
    successMessage: "Thank you! Your project pitch has been successfully submitted to Cinenow. We will review it shortly."
  }
};

const outputPath = path.join(__dirname, "../../seeds.json");
fs.writeFileSync(outputPath, JSON.stringify(formTemplate, null, 2), "utf-8");
console.log(`✅ Dynamically generated seeds.json with ${logicRules.length} logic rules!`);
