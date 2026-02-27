/**
 * SVG logos for known SaaS tools, stored as data URLs.
 * Used by seed.ts and can be used to update existing projects.
 */

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Salesforce — blue cloud
const salesforceSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#00A1E0"/>
<g transform="translate(100,105)">
  <ellipse cx="0" cy="0" rx="55" ry="32" fill="white"/>
  <ellipse cx="-30" cy="-15" rx="28" ry="28" fill="white"/>
  <ellipse cx="10" cy="-22" rx="32" ry="30" fill="white"/>
  <ellipse cx="38" cy="-8" rx="22" ry="22" fill="white"/>
</g>
</svg>`;

// SAP — blue rectangle with SAP text
const sapSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#0070F2"/>
<text x="100" y="115" font-family="Arial,Helvetica,sans-serif" font-size="56" font-weight="bold" fill="white" text-anchor="middle">SAP</text>
</svg>`;

// Workday — gold/orange with sun rays
const workdaySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#F5A623"/>
<circle cx="100" cy="100" r="28" fill="white"/>
<g stroke="white" stroke-width="6" stroke-linecap="round">
  <line x1="100" y1="52" x2="100" y2="62"/>
  <line x1="100" y1="138" x2="100" y2="148"/>
  <line x1="52" y1="100" x2="62" y2="100"/>
  <line x1="138" y1="100" x2="148" y2="100"/>
  <line x1="66" y1="66" x2="73" y2="73"/>
  <line x1="127" y1="127" x2="134" y2="134"/>
  <line x1="134" y1="66" x2="127" y2="73"/>
  <line x1="73" y1="127" x2="66" y2="134"/>
</g>
</svg>`;

// ServiceNow — teal green with stylized SN
const serviceNowSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#81B5A1"/>
<circle cx="100" cy="100" r="50" fill="white" opacity="0.25"/>
<text x="100" y="118" font-family="Arial,Helvetica,sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle">SN</text>
</svg>`;

// HubSpot — orange with sprocket/gear
const hubspotSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#FF7A59"/>
<g transform="translate(100,100)">
  <circle cx="0" cy="0" r="18" fill="none" stroke="white" stroke-width="8"/>
  <circle cx="0" cy="0" r="6" fill="white"/>
  <g stroke="white" stroke-width="8" stroke-linecap="round">
    <line x1="0" y1="-18" x2="0" y2="-36"/>
    <line x1="0" y1="18" x2="0" y2="36"/>
    <line x1="-18" y1="0" x2="-36" y2="0"/>
    <line x1="18" y1="0" x2="36" y2="0"/>
    <line x1="-13" y1="-13" x2="-25" y2="-25"/>
    <line x1="13" y1="13" x2="25" y2="25"/>
    <line x1="13" y1="-13" x2="25" y2="-25"/>
    <line x1="-13" y1="13" x2="-25" y2="25"/>
  </g>
</g>
</svg>`;

// Zendesk — dark teal with Z
const zendeskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#03363D"/>
<path d="M60 70h80v12L72 130h68v12H60v-12l68-48H60z" fill="white"/>
</svg>`;

// Oracle — red with O
const oracleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#C74634"/>
<circle cx="100" cy="100" r="38" fill="none" stroke="white" stroke-width="12"/>
</svg>`;

// Microsoft Dynamics — blue with grid/D
const dynamicsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#0078D4"/>
<g fill="white">
  <rect x="56" y="56" width="38" height="38" rx="4"/>
  <rect x="106" y="56" width="38" height="38" rx="4"/>
  <rect x="56" y="106" width="38" height="38" rx="4"/>
  <rect x="106" y="106" width="38" height="38" rx="4"/>
</g>
</svg>`;

// Jira — blue with angle brackets
const jiraSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#0052CC"/>
<g fill="none" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="85,60 55,100 85,140"/>
  <polyline points="115,60 145,100 115,140"/>
</g>
</svg>`;

// Confluence — blue with book/pages
const confluenceSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="40" fill="#1868DB"/>
<g fill="white">
  <path d="M60 130c5-12 12-28 30-28 20 0 22 16 40 16 10 0 15-4 18-8l10 16c-5 10-14 20-30 20-20 0-24-16-40-16-10 0-16 6-20 12z"/>
  <path d="M140 74c-5 12-12 28-30 28-20 0-22-16-40-16-10 0-15 4-18 8l-10-16c5-10 14-20 30-20 20 0 24 16 40 16 10 0 16-6 20-12z"/>
</g>
</svg>`;

/**
 * Map of tool names (lowercase) → SVG data URL.
 * Lookup is case-insensitive: use toolName.toLowerCase().
 */
export const TOOL_LOGOS: Record<string, string> = {
  salesforce: svgToDataUrl(salesforceSvg),
  'sap successfactors': svgToDataUrl(sapSvg),
  sap: svgToDataUrl(sapSvg),
  workday: svgToDataUrl(workdaySvg),
  servicenow: svgToDataUrl(serviceNowSvg),
  hubspot: svgToDataUrl(hubspotSvg),
  zendesk: svgToDataUrl(zendeskSvg),
  oracle: svgToDataUrl(oracleSvg),
  'microsoft dynamics': svgToDataUrl(dynamicsSvg),
  dynamics: svgToDataUrl(dynamicsSvg),
  jira: svgToDataUrl(jiraSvg),
  confluence: svgToDataUrl(confluenceSvg),
};

/**
 * Returns the logo data URL for a tool name, or null if not found.
 */
export function getToolLogo(toolName: string): string | null {
  return TOOL_LOGOS[toolName.toLowerCase()] ?? null;
}
