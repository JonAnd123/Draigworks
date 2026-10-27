/* Welsh strings for tasks, maintenance, logs, policies, staff compliance and audits (best-effort — please have a Welsh speaker proofread). Existing keys win. */
(function () {
  var cy = window.CC_CY = window.CC_CY || {};
  var add = {
    "Not set": "Heb ei osod", "No tasks yet.": "Dim tasgau eto.", "Add the recommended set to get started.": "Ychwanegwch y set a argymhellir i ddechrau.",
    "Task": "Tasg", "Repeats": "Yn ailadrodd", "Assigned to": "Wedi'i neilltuo i", "Next due": "Dyledus nesaf", "Last done": "Gwnaed ddiwethaf", "Practice team": "Tîm y practis",
    "Mark done": "Nodi wedi'i wneud", "leave": "gwyliau", "more": "arall", "Task due": "Tasg yn ddyledus", "Overdue / inspection": "Hwyr / arolygiad", "Done": "Wedi'i wneud",
    "Tasks & calendar": "Tasgau a chalendr", "Recurring checks, audits and reviews. Mark them done and the next date is set for you.": "Gwiriadau, archwiliadau ac adolygiadau cylchol. Nodwch eu bod wedi'u gwneud a gosodir y dyddiad nesaf i chi.",
    "Add recommended tasks": "Ychwanegu tasgau a argymhellir", "Add task": "Ychwanegu tasg", "Due in the next 7 days": "Yn ddyledus o fewn 7 diwrnod", "Done on time (90 days)": "Wedi'u gwneud mewn pryd (90 diwrnod)",
    "{n} completed": "{n} wedi'u cwblhau", "Nothing scheduled.": "Dim wedi'i drefnu.", "Edit task": "Golygu tasg", "Delete this task and its history?": "Dileu'r dasg hon a'i hanes?",
    "Note (optional)": "Nodyn (dewisol)", "Done. Next due {d}.": "Wedi'i wneud. Dyledus nesaf {d}.", "Done.": "Wedi'i wneud.", "All recommended tasks are already added.": "Mae'r holl dasgau a argymhellir eisoes wedi'u hychwanegu.",
    "Starting points only: adjust how often each one repeats to suit your practice.": "Mannau cychwyn yn unig: addaswch pa mor aml mae pob un yn ailadrodd i weddu i'ch practis.",
    "First due date": "Dyddiad dyledus cyntaf", "Choose at least one task.": "Dewiswch o leiaf un dasg.", "Tasks added.": "Tasgau wedi'u hychwanegu.",
    "Date needed": "Angen dyddiad", "In date": "O fewn dyddiad", "Maintenance register": "Cofrestr cynnal a chadw",
    "Services, tests, insurance and certificates. Enter when each was last done and the next date is worked out for you.": "Gwasanaethau, profion, yswiriant a thystysgrifau. Rhowch pryd y gwnaed pob un ddiwethaf a chyfrifir y dyddiad nesaf i chi.",
    "Add recommended items": "Ychwanegu eitemau a argymhellir", "Add item": "Ychwanegu eitem", "Due within 60 days": "Yn ddyledus o fewn 60 diwrnod", "Dates still to enter": "Dyddiadau i'w rhoi o hyd",
    "Done today": "Wedi'i wneud heddiw", "Nothing in the register yet.": "Dim yn y gofrestr eto.", "Add the recommended items to get started.": "Ychwanegwch yr eitemau a argymhellir i ddechrau.",
    "Edit item": "Golygu eitem", "Remove this item from the register": "Tynnu'r eitem hon o'r gofrestr", "All recommended items are already added.": "Mae'r holl eitemau a argymhellir eisoes wedi'u hychwanegu.",
    "Starting points only. Intervals depend on your equipment and risk assessments, so adjust them with your advisers.": "Mannau cychwyn yn unig. Mae cyfnodau'n dibynnu ar eich offer a'ch asesiadau risg, felly addaswch nhw gyda'ch ymgynghorwyr.",
    "Choose at least one item.": "Dewiswch o leiaf un eitem.", "Items added.": "Eitemau wedi'u hychwanegu.",
    "No entries yet": "Dim cofnodion eto", "Last entry needs action": "Mae angen gweithredu ar y cofnod diwethaf", "Not done today": "Heb ei wneud heddiw", "Up to date": "Cyfredol", "Last: {d}": "Diwethaf: {d}", "Add entry": "Ychwanegu cofnod",
    "Logs": "Logiau", "Daily and weekly checks, signed with your name and the time. Entries cannot be edited or deleted.": "Gwiriadau dyddiol ac wythnosol, wedi'u llofnodi â'ch enw a'r amser. Ni ellir golygu na dileu cofnodion.",
    "Entries needing action (30 days)": "Cofnodion sydd angen gweithredu (30 diwrnod)", "Recent entries": "Cofnodion diweddar", "All logs": "Pob log", "Log": "Log", "By": "Gan", "No entries yet.": "Dim cofnodion eto.",
    "expected {a} to {b}": "disgwylir {a} i {b}", "Note / action taken": "Nodyn / gweithred a gymerwyd", "Something is missing or out of range. Please note what action you have taken.": "Mae rhywbeth ar goll neu y tu allan i'r ystod. Nodwch pa gamau a gymerwyd gennych.",
    "Entry saved.": "Cofnod wedi'i gadw.", "Entry saved: action needed.": "Cofnod wedi'i gadw: angen gweithredu.", "Save entry": "Cadw cofnod",
    "Tasks done on time": "Tasgau wedi'u gwneud mewn pryd", "{n} due this week or overdue": "{n} yn ddyledus yr wythnos hon neu'n hwyr", "Policies to review": "Polisïau i'w hadolygu", "{a} of {b} reviewed by you": "{a} o {b} wedi'u hadolygu gennych chi",
    "Staff compliance": "Cydymffurfiaeth staff", "training, recruitment and policies": "hyfforddiant, recriwtio a pholisïau", "Maintenance overdue": "Cynnal a chadw hwyr", "{n} log entries need action": "Mae angen gweithredu ar {n} cofnod log",
    "Log entries needing action": "Cofnodion log sydd angen gweithredu", "last 30 days": "30 diwrnod diwethaf", "Coming up": "I ddod", "List": "Rhestr", "Add": "Ychwanegu",
    "Template policies to adapt for your practice. Read each one and confirm you have understood it.": "Polisïau templed i'w haddasu ar gyfer eich practis. Darllenwch bob un a chadarnhewch eich bod wedi'i ddeall.",
    "These are starting templates, not legal advice. Add your own names and details, and have a dental compliance adviser check them against HIW's current requirements.": "Templedi cychwynnol yw'r rhain, nid cyngor cyfreithiol. Ychwanegwch eich enwau a'ch manylion eich hun, a gofynnwch i ymgynghorydd cydymffurfiaeth ddeintyddol eu gwirio yn erbyn gofynion cyfredol AGIC.",
    "All policies": "Pob polisi", "To review": "I'w hadolygu", "Reviewed": "Wedi'u hadolygu", "Policy": "Polisi", "Folder": "Ffolder", "Updated": "Diweddarwyd", "You": "Chi", "Team reviewed": "Tîm wedi adolygu", "Read": "Darllen",
    "Policy text is in English": "Mae testun y polisi yn Saesneg", "You reviewed this policy": "Rydych wedi adolygu'r polisi hwn", "Training": "Hyfforddiant", "Recruitment": "Recriwtio", "{n} out of date": "{n} allan o ddyddiad",
    "Dates show when each course was completed. Courses go out of date after their usual interval. Select a cell to record a date or mark it not applicable.": "Mae'r dyddiadau'n dangos pryd cwblhawyd pob cwrs. Mae cyrsiau'n mynd allan o ddyddiad ar ôl eu cyfnod arferol. Dewiswch gell i gofnodi dyddiad neu nodi nad yw'n berthnasol.",
    "Valid until {d}": "Dilys tan {d}", "A tick means the document is on file. GDC, DBS, indemnity and emergency contact also tick automatically when entered on the HR record.": "Mae tic yn golygu bod y ddogfen ar ffeil. Mae GDC, DBS, indemniad a chyswllt brys hefyd yn cael tic yn awtomatig pan gânt eu rhoi ar y cofnod AD.",
    "Missing": "ar goll", "From the HR record": "O'r cofnod AD", "Training, recruitment paperwork and policy sign-off for each person.": "Hyfforddiant, gwaith papur recriwtio a llofnodi polisïau ar gyfer pob person.",
    "{n} staff": "{n} aelod o staff", "Training out of date": "Hyfforddiant allan o ddyddiad", "Overview": "Trosolwg", "Training matrix": "Matrics hyfforddi", "Recruitment checklist": "Rhestr wirio recriwtio",
    "No staff records yet. Add people in HR first.": "Dim cofnodion staff eto. Ychwanegwch bobl yn AD yn gyntaf.", "Completed on": "Cwblhawyd ar", "Date on file (optional)": "Dyddiad ar ffeil (dewisol)",
    "Not applicable to this person": "Ddim yn berthnasol i'r person hwn", "Clear this record": "Clirio'r cofnod hwn", "Enter the date it was completed, or mark it not applicable.": "Rhowch y dyddiad y cwblhawyd, neu nodwch nad yw'n berthnasol.",
    "Audits": "Archwiliadau", "Routine audits inspectors expect to see. The HIW self-assessment is under Compliance check.": "Archwiliadau arferol y mae arolygwyr yn disgwyl eu gweld. Mae hunanasesiad AGIC o dan Gwiriad cydymffurfiaeth.",
    "Start a new audit": "Dechrau archwiliad newydd", "Start your first audit": "Dechrau eich archwiliad cyntaf", "{n} questions": "{n} cwestiwn", "Last score {s}% on {d}": "Sgôr diwethaf {s}% ar {d}",
    "No audits completed yet.": "Dim archwiliadau wedi'u cwblhau eto.", "Answers save automatically. Complete the audit to generate your gap report.": "Mae atebion yn cadw'n awtomatig. Cwblhewch yr archwiliad i gynhyrchu eich adroddiad bylchau.",
    "Complete audit": "Cwblhau'r archwiliad", "Audit completed.": "Archwiliad wedi'i gwblhau.", "I have read and understood": "Rwyf wedi darllen a deall",
    "Just once": "Unwaith yn unig", "Every day": "Bob dydd", "Every week": "Bob wythnos", "Every two weeks": "Bob pythefnos", "Every four weeks": "Bob pedair wythnos", "Every month": "Bob mis", "Every three months": "Bob tri mis",
    "Every six months": "Bob chwe mis", "Every year": "Bob blwyddyn", "Every 14 months": "Bob 14 mis", "Every two years": "Bob dwy flynedd", "Every 26 months": "Bob 26 mis", "Every three years": "Bob tair blynedd", "Every five years": "Bob pum mlynedd",
    "Daily": "Dyddiol", "Each working day": "Bob diwrnod gwaith", "Weekly": "Wythnosol", "Monthly": "Misol", "Daily or per session": "Dyddiol neu fesul sesiwn",
    "Intra-oral": "Mewn-geg", "Extra-oral / OPG": "All-geg / OPG", "CBCT": "CBCT",
    "General": "Cyffredinol", "Electrical": "Trydanol", "Fire": "Tân", "Gas & air": "Nwy ac aer", "Decontamination": "Diheintio", "Pressure vessels": "Llestri gwasgedd", "Radiation": "Ymbelydredd", "Waste": "Gwastraff",
    "Governance": "Llywodraethu", "Safeguarding": "Diogelu", "Infection control": "Rheoli heintiau", "Information governance": "Llywodraethu gwybodaeth", "Clinical": "Clinigol", "Staffing": "Staffio",
    "Hand hygiene & PPE": "Hylendid dwylo ac offer diogelu personol", "Surgery & environment": "Meddygfa ac amgylchedd", "Sharps & waste": "Eitemau miniog a gwastraff", "Patient details & history": "Manylion a hanes y claf",
    "Examination & diagnosis": "Archwilio a diagnosis", "Treatment & consent": "Triniaeth a chydsyniad", "Radiographs & referrals": "Radiograffau a chyfeiriadau", "Prescribing decisions": "Penderfyniadau presgripsiynu",
    "Safety & follow-up": "Diogelwch a dilyniant", "Running the survey": "Cynnal yr arolwg", "Acting on results": "Gweithredu ar ganlyniadau", "Getting in": "Mynd i mewn", "Facilities": "Cyfleusterau", "Information & people": "Gwybodaeth a phobl",
    "Appearance": "Edrychiad", "Choose how the portal looks. Your choice is remembered each time you sign in.": "Dewiswch sut mae'r porth yn edrych. Cofir eich dewis bob tro y byddwch yn mewngofnodi.", "Dark (default)": "Tywyll (rhagosodiad)", "Light": "Golau", "Maintenance": "Cynnal a chadw", "Health & safety": "Iechyd a diogelwch"
  };
  Object.keys(add).forEach(function (k) { if (!(k in cy)) cy[k] = add[k]; });
})();

/* Policy templates (copies per practice, editing, upload) */
(function () {
  var cy = window.CC_CY = window.CC_CY || {};
  var add = {
 "Your practice's policies. Each one starts as a template: complete the highlighted details, or replace it with your own document. Read each one and confirm you have understood it.": "Polisïau eich practis. Mae pob un yn dechrau fel templed: llenwch y manylion sydd wedi'u hamlygu, neu rhowch eich dogfen eich hun yn ei le. Darllenwch bob un a chadarnhewch eich bod wedi'i deall.",
 "Adopted": "Wedi'i fabwysiadu",
 "Template — to adopt": "Templed — i'w fabwysiadu",
 "Uploaded file": "Ffeil wedi'i huwchlwytho",
 "Newer template": "Templed mwy newydd",
 "The master template has been updated since this copy was made.": "Mae'r templed meistr wedi'i ddiweddaru ers creu'r copi hwn.",
 "{n} fields to complete": "{n} maes i'w llenwi",
 "Review due": "Adolygiad yn ddyledus",
 "Overdue": "Hwyr",
 "Due soon": "Yn ddyledus cyn bo hir",
 "Team reviewed": "Tîm wedi adolygu",
 "Adopted by the practice": "Wedi'i fabwysiadu gan y practis",
 "Adopted policies count towards the compliance score and appear under Evidence.": "Mae polisïau a fabwysiadwyd yn cyfrif tuag at y sgôr cydymffurfio ac yn ymddangos o dan Dystiolaeth.",
 "No policies match.": "Dim polisïau'n cyfateb.",
 "Template, not yet adopted by the practice": "Templed, heb ei fabwysiadu eto gan y practis",
 "Loading document…": "Yn llwytho'r ddogfen…",
 "Download": "Lawrlwytho",
 "Edit policy": "Golygu polisi",
 "Saving adopts this policy for the practice and asks the team to read it again.": "Mae cadw yn mabwysiadu'r polisi hwn ar gyfer y practis ac yn gofyn i'r tîm ei ddarllen eto.",
 "The master template has been updated since this copy was made. You can keep your version or reset to the latest template.": "Mae'r templed meistr wedi'i ddiweddaru ers creu'r copi hwn. Gallwch gadw eich fersiwn neu ailosod i'r templed diweddaraf.",
 "Policy text": "Testun y polisi",
 "Or replace the text with your own document (PDF, PNG or JPG, up to 10 MB)": "Neu rhowch eich dogfen eich hun yn lle'r testun (PDF, PNG neu JPG, hyd at 10 MB)",
 "Staff read uploaded files in the browser and cannot download them. Other roles can download.": "Mae staff yn darllen ffeiliau a uwchlwythwyd yn y porwr ac ni allant eu lawrlwytho. Gall rolau eraill lawrlwytho.",
 "Remove the uploaded file and use the text above": "Tynnu'r ffeil a uwchlwythwyd a defnyddio'r testun uchod",
 "Next review due": "Adolygiad nesaf yn ddyledus",
 "Reset to the latest template": "Ailosod i'r templed diweddaraf",
 "Use ## for a heading and - for a bullet point. Details in [square brackets] are placeholders for you to complete.": "Defnyddiwch ## ar gyfer pennawd a - ar gyfer pwynt bwled. Mae manylion mewn [cromfachau sgwâr] yn dalfeydd i chi eu llenwi.",
 "Replace this policy with the latest master template? Your changes and any uploaded file will be removed and the policy will need adopting again.": "Disodli'r polisi hwn gyda'r templed meistr diweddaraf? Bydd eich newidiadau ac unrhyw ffeil a uwchlwythwyd yn cael eu tynnu a bydd angen mabwysiadu'r polisi eto.",
 "Reset": "Ailosod",
 "Please enter the policy text or upload a file.": "Rhowch destun y polisi neu uwchlwythwch ffeil.",
 "Please upload a PDF, PNG or JPG file so everyone can read it in the browser.": "Uwchlwythwch ffeil PDF, PNG neu JPG fel y gall pawb ei darllen yn y porwr.",
 "An uploaded file is currently shown to the team: {name}. Upload another file to replace it, or tick the box below to use the text instead.": "Mae ffeil a uwchlwythwyd yn cael ei dangos i'r tîm: {name}. Uwchlwythwch ffeil arall i'w disodli, neu ticiwch y blwch isod i ddefnyddio'r testun.",
 "Practice copies": "Copïau practis",
 "Master templates": "Templedi meistr",
 "New policy": "Polisi newydd",
 "Edit master template": "Golygu'r templed meistr",
 "Title in Welsh": "Teitl yn Gymraeg",
 "Master templates. Every practice has its own copy; editing a master does not change copies that already exist, but practices are told a newer template is available.": "Templedi meistr. Mae gan bob practis ei gopi ei hun; nid yw golygu meistr yn newid copïau sy'n bodoli eisoes, ond dywedir wrth bractisau fod templed mwy newydd ar gael.",
 "Use ## for a heading and - for a bullet point. {{practice}} becomes the practice name. Details in [square brackets] are for each practice to complete.": "Defnyddiwch ## ar gyfer pennawd a - ar gyfer pwynt bwled. Mae {{practice}} yn dod yn enw'r practis. Mae manylion mewn [cromfachau sgwâr] i bob practis eu llenwi.",
 "Open policy": "Agor y polisi",
 "Template": "Templed",
 "Policy template, not yet adopted": "Templed polisi, heb ei fabwysiadu eto",
 "Edit": "Golygu"
};
  Object.keys(add).forEach(function (k) { if (!(k in cy)) cy[k] = add[k]; });
})();
(function () {
  var cy = window.CC_CY = window.CC_CY || {};
  var add = { "Formatting": "Fformatio", "Style": "Arddull", "Normal text": "Testun arferol", "Title": "Teitl", "Heading": "Pennawd", "Subheading": "Is-bennawd", "Bold": "Trwm", "Italic": "Italig", "Underline": "Tanlinellu",
    "Bullet list": "Rhestr bwyntiau", "Numbered list": "Rhestr rifedig", "Decrease indent": "Lleihau mewnoliad", "Increase indent": "Cynyddu mewnoliad", "Undo": "Dadwneud", "Redo": "Ailwneud", "Clear formatting": "Clirio fformatio",
    "Details in [square brackets] are placeholders for you to complete.": "Mae manylion mewn [cromfachau sgwâr] yn dalfeydd i chi eu llenwi.",
    "{{practice}} becomes the practice name. Details in [square brackets] are for each practice to complete.": "Mae {{practice}} yn dod yn enw'r practis. Mae manylion mewn [cromfachau sgwâr] i bob practis eu llenwi." };
  Object.keys(add).forEach(function (k) { if (!(k in cy)) cy[k] = add[k]; });
})();
(function () {
  var cy = window.CC_CY = window.CC_CY || {};
  var add = { "Preview new template": "Rhagolwg o'r templed newydd", "Newer template": "Templed mwy newydd", "New template": "Templed newydd", "Your current copy": "Eich copi presennol", "Use this template": "Defnyddio'r templed hwn",
    "Master template v{n}, your copy was made from v{m}.": "Templed meistr f{n}, gwnaed eich copi o f{m}.", "Your copy is an uploaded file: {name}": "Mae eich copi yn ffeil a uwchlwythwyd: {name}",
    "Replaces your copy and any uploaded file; the policy must then be adopted again.": "Yn disodli eich copi ac unrhyw ffeil a uwchlwythwyd; yna rhaid mabwysiadu'r polisi eto." };
  Object.keys(add).forEach(function (k) { if (!(k in cy)) cy[k] = add[k]; });
})();
(function () {
  var cy = window.CC_CY = window.CC_CY || {};
  var add = { "Sort by": "Trefnu yn ôl", "Name (A to Z)": "Enw (A i Z)", "Policy ID": "ID y polisi" };
  Object.keys(add).forEach(function (k) { if (!(k in cy)) cy[k] = add[k]; });
})();
