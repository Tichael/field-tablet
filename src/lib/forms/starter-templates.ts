import type { FormTemplate } from "../../types/form";

export const STARTER_DAILY_REPORT: FormTemplate = {
  id: "daily-report",
  title: "Daily Report",
  description:
    "End of shift daily progress, crew, work performed, and site conditions.",
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  folderPath: "Reports/Daily Report",
  category: "Reports",
  sections: [
    {
      id: "general_info",
      title: "General Information",
      description: "Basic site and shift details",
      fields: [
        {
          id: "work_date",
          type: "date",
          label: "Date",
          required: true,
          defaultValue: new Date().toISOString().split("T")[0],
        },
        {
          id: "shift",
          type: "select",
          label: "Shift",
          required: true,
          defaultValue: "day",
          options: [
            { label: "Day Shift (07:00 - 15:30)", value: "day" },
            { label: "Evening Shift (15:30 - 23:00)", value: "evening" },
            { label: "Night Shift (23:00 - 07:00)", value: "night" },
          ],
        },
        {
          id: "supervisor_name",
          type: "text",
          label: "Supervisor / Lead Technician",
          placeholder: "e.g. Jane Doe",
          required: true,
          isIdentifier: true,
        },
        {
          id: "site_location",
          type: "text",
          label: "Site / Unit Location",
          placeholder: "e.g. Substation B - Bay 3",
          required: true,
        },
        {
          id: "weather_conditions",
          type: "select",
          label: "Weather & Site Conditions",
          options: [
            { label: "Clear / Dry", value: "clear" },
            { label: "Overcast", value: "overcast" },
            { label: "Rain / Wet", value: "rain" },
            { label: "Extreme Cold / Ice", value: "cold" },
            { label: "Extreme Heat", value: "heat" },
          ],
        },
      ],
    },
    {
      id: "work_details",
      title: "Work Performed & Progress",
      description: "Summary of activities completed during shift",
      fields: [
        {
          id: "crew_size",
          type: "number",
          label: "Total Personnel Onsite",
          placeholder: "e.g. 4",
          defaultValue: 1,
        },
        {
          id: "work_completed",
          type: "textarea",
          label: "Work Activities Completed",
          placeholder:
            "Describe tasks completed, milestones reached, and tests conducted...",
          required: true,
        },
        {
          id: "delays_issues",
          type: "textarea",
          label: "Delays, Roadblocks or Outstanding Items",
          placeholder:
            "List any delays due to weather, parts, safety, or access issues...",
        },
        {
          id: "safety_incident_occurred",
          type: "checkbox",
          label: "Any safety incidents or near misses today?",
          defaultValue: false,
        },
      ],
    },
    {
      id: "signoff",
      title: "Sign-Off & Verification",
      fields: [
        {
          id: "notes",
          type: "notes",
          label:
            "By signing below, I certify that the information reported above is accurate and true to the best of my knowledge.",
        },
        {
          id: "signature",
          type: "signature",
          label: "Supervisor Digital Signature",
          required: true,
        },
      ],
    },
  ],
};

export const STARTER_INCIDENT_LOG: FormTemplate = {
  id: "incident-log",
  title: "Incident Log",
  description:
    "Immediate documentation of safety, equipment, or environmental incidents.",
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  folderPath: "Reports/Incident Log",
  category: "Reports",
  sections: [
    {
      id: "incident_details",
      title: "Incident Details",
      fields: [
        {
          id: "incident_datetime",
          type: "datetime",
          label: "Incident Date & Time",
          required: true,
          defaultValue: new Date().toISOString().slice(0, 16),
        },
        {
          id: "incident_type",
          type: "select",
          label: "Incident Classification",
          required: true,
          defaultValue: "safety",
          options: [
            { label: "Safety / Personal Injury", value: "safety" },
            { label: "Near Miss / Hazard Identification", value: "near_miss" },
            { label: "Equipment / Asset Damage", value: "equipment" },
            { label: "Environmental / Spill", value: "environmental" },
            { label: "Security / Unauthorized Access", value: "security" },
          ],
        },
        {
          id: "severity",
          type: "radio",
          label: "Severity Level",
          required: true,
          defaultValue: "medium",
          options: [
            { label: "Low (Minor / First Aid)", value: "low" },
            { label: "Medium (Moderate / Lost Time Risk)", value: "medium" },
            { label: "High (Major Damage / Medical Treatment)", value: "high" },
            {
              label: "Critical (Severe / Life-Threatening)",
              value: "critical",
            },
          ],
        },
        {
          id: "location",
          type: "text",
          label: "Specific Incident Location",
          placeholder: "e.g. Pump Room #2, Northeast corner",
          required: true,
          isIdentifier: true,
        },
      ],
    },
    {
      id: "incident_description",
      title: "Description & Immediate Action",
      fields: [
        {
          id: "description",
          type: "textarea",
          label: "What Happened? (Detailed Description)",
          placeholder:
            "Describe sequence of events, persons involved, equipment in use, and immediate result...",
          required: true,
        },
        {
          id: "immediate_actions",
          type: "textarea",
          label: "Immediate Actions Taken",
          placeholder:
            "e.g. Area isolated, power disconnected, first aid applied, spill kit deployed...",
          required: true,
        },
        {
          id: "witnesses",
          type: "text",
          label: "Witnesses (Names & Contact)",
          placeholder: "e.g. Bob Smith, Alice Wong",
        },
      ],
    },
    {
      id: "reporter_signoff",
      title: "Reporter Sign-Off",
      fields: [
        {
          id: "reporter_name",
          type: "text",
          label: "Reported By (Full Name)",
          required: true,
        },
        {
          id: "signature",
          type: "signature",
          label: "Reporter Signature",
          required: true,
        },
      ],
    },
  ],
};

export const STARTER_EQUIPMENT_CHECK: FormTemplate = {
  id: "equipment-check",
  title: "Equipment Check",
  description: "Pre-operational and routine machinery safety inspection.",
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  folderPath: "Inspections/Equipment Check",
  category: "Inspections",
  sections: [
    {
      id: "equipment_info",
      title: "Equipment Identification",
      fields: [
        {
          id: "equipment_id",
          type: "text",
          label: "Equipment Name / Unit ID",
          placeholder: "e.g. Forklift #4 or Generator CAT-3500",
          required: true,
          isIdentifier: true,
        },
        {
          id: "serial_number",
          type: "text",
          label: "Serial Number",
          placeholder: "e.g. SN-8839210-B",
        },
        {
          id: "hour_meter",
          type: "number",
          label: "Hour Meter / Odometer Reading",
          placeholder: "e.g. 1420",
        },
        {
          id: "inspector_name",
          type: "text",
          label: "Inspector Name",
          placeholder: "e.g. Alex Taylor",
          required: true,
        },
      ],
    },
    {
      id: "pre_start_checklist",
      title: "Pre-Start Visual & Mechanical Checks",
      description: "Verify all items prior to equipment operation",
      fields: [
        {
          id: "fluids_check",
          type: "select",
          label: "Engine Oil, Coolant & Fluid Levels",
          required: true,
          defaultValue: "pass",
          options: [
            { label: "Pass - Normal Levels", value: "pass" },
            { label: "Attention - Low / Topped Up", value: "attention" },
            { label: "Fail - Leaks Detected", value: "fail" },
          ],
        },
        {
          id: "hydraulics_check",
          type: "select",
          label: "Hydraulic Hoses & Cylinders",
          required: true,
          defaultValue: "pass",
          options: [
            { label: "Pass - Clean & Tight", value: "pass" },
            { label: "Attention - Minor Weeping", value: "attention" },
            { label: "Fail - Damaged Hose / Active Leak", value: "fail" },
          ],
        },
        {
          id: "tires_tracks_check",
          type: "select",
          label: "Tires / Tracks & Hardware",
          required: true,
          defaultValue: "pass",
          options: [
            { label: "Pass - Good Condition & Pressure", value: "pass" },
            { label: "Attention - Moderate Wear", value: "attention" },
            { label: "Fail - Severe Cut / Flat / Loose Lug", value: "fail" },
          ],
        },
        {
          id: "safety_guards_check",
          type: "checkbox",
          label: "All safety guards and covers securely in place?",
          defaultValue: true,
        },
        {
          id: "emergency_stop_check",
          type: "checkbox",
          label: "Emergency stop button and horns tested & operational?",
          defaultValue: true,
        },
        {
          id: "overall_status",
          type: "radio",
          label: "Final Operational Determination",
          required: true,
          defaultValue: "safe",
          options: [
            { label: "SAFE TO OPERATE", value: "safe" },
            { label: "RESTRICTED (Needs Minor Service)", value: "restricted" },
            { label: "OUT OF SERVICE / TAGGED OUT", value: "tagged_out" },
          ],
        },
        {
          id: "inspector_comments",
          type: "textarea",
          label: "Defects Noted & Corrective Actions",
          placeholder:
            "Describe any abnormalities, needed repairs, or corrective actions taken...",
        },
      ],
    },
    {
      id: "inspection_signoff",
      title: "Inspector Certification",
      fields: [
        {
          id: "signature",
          type: "signature",
          label: "Inspector Signature",
          required: true,
        },
      ],
    },
  ],
};

export const ALL_STARTER_TEMPLATES: FormTemplate[] = [
  STARTER_DAILY_REPORT,
  STARTER_INCIDENT_LOG,
  STARTER_EQUIPMENT_CHECK,
];
