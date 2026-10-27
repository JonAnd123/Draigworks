-- ==========================================================================
-- 08_policy_templates.sql
-- Policies become per-practice templates that are linked to Evidence.
--   * Each practice automatically gets its own copy of every policy (an evidence row
--     in the "policies" category with policy_id set). The master library is edited by
--     the platform admin only.
--   * Principals / Practice Managers (and Group Admins, for practices in their group)
--     edit their practice's copy or replace it with an uploaded file.
--   * Staff can read their practice's ADOPTED policies (text, or an uploaded file shown in the
--     browser) and sign them off. Templates not yet adopted are hidden from staff.
--   * A policy copy only counts towards the compliance score once it has been adopted.
-- Run once in the Supabase SQL editor after 01-07. Safe to re-run: the text is only
-- replaced (and its version raised) when it has changed.
-- Policy text is a TEMPLATE for expert review, not legal advice.
-- ==========================================================================

-- ---------- columns ----------
alter table public.evidence add column if not exists policy_id int references public.policies(id) on delete set null;
alter table public.evidence add column if not exists body text;
alter table public.evidence add column if not exists template_version int;
alter table public.evidence add column if not exists adopted_at timestamptz;
alter table public.evidence_versions add column if not exists body text;
create unique index if not exists evidence_practice_policy on public.evidence (practice_id, policy_id) where policy_id is not null;

-- ---------- guard: group admins may verify policy copies; policy link cannot change ----------
create or replace function public.evidence_guard() returns trigger
language plpgsql security definer set search_path = public as
$$
declare can_verify boolean;
begin
  new.updated_at := now();
  if auth.uid() is null then return new; end if;  -- trusted backend / SQL editor
  if new.practice_id <> old.practice_id then raise exception 'Cannot move evidence'; end if;
  if new.policy_id is distinct from old.policy_id then raise exception 'The policy link cannot change'; end if;
  can_verify := public.can_manage_practice(old.practice_id)
                or (old.policy_id is not null and public.is_group_admin_of(old.practice_id));
  if new.status is distinct from old.status then
    if not can_verify then
      if new.status <> 'pending' then raise exception 'Only a Principal or Practice Manager can verify evidence'; end if;
    else
      if new.status in ('verified','rejected') then
        new.verified_by := auth.uid(); new.verified_at := now();
      end if;
    end if;
  end if;
  return new;
end $$;

-- ---------- row-level security ----------
drop policy if exists evidence_policy_select on public.evidence;
create policy evidence_policy_select on public.evidence for select to authenticated using (
  policy_id is not null and public.can_read_practice(practice_id)
  and (adopted_at is not null                      -- staff only see policies the practice has adopted
       or public.can_manage_practice(practice_id)
       or public.is_group_admin_of(practice_id)
       or public.has_inspector_grant(practice_id)));

drop policy if exists evidence_policy_ga_update on public.evidence;
create policy evidence_policy_ga_update on public.evidence for update to authenticated
  using (policy_id is not null and public.is_group_admin_of(practice_id))
  with check (policy_id is not null and public.is_group_admin_of(practice_id));

-- version history: only people who may edit the item can add a version
drop policy if exists evver_insert on public.evidence_versions;
create policy evver_insert on public.evidence_versions for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (
    select 1 from public.evidence e where e.id = evidence_id and (
      public.can_manage_practice(e.practice_id)
      or (e.policy_id is not null and public.is_group_admin_of(e.practice_id))
      or e.uploaded_by = auth.uid())));

-- sign-off is for the version of the practice's own copy
drop policy if exists reviews_insert on public.policy_reviews;
create policy reviews_insert on public.policy_reviews for insert to authenticated with check (
  profile_id = auth.uid()
  and practice_id = (select p.practice_id from public.profiles p where p.id = auth.uid() and p.active)
  and version = (select e.current_version from public.evidence e
                  where e.practice_id = policy_reviews.practice_id and e.policy_id = policy_reviews.policy_id));

-- ---------- storage: staff read policy files of their practice; group admins can upload ----------
drop policy if exists evidence_obj_select on storage.objects;
create policy evidence_obj_select on storage.objects for select to authenticated using (
  bucket_id = 'evidence' and (
    public.can_manage_practice(((storage.foldername(name))[1])::uuid)
    or public.has_inspector_grant(((storage.foldername(name))[1])::uuid)
    or (owner = auth.uid() and public.auth_role() is not null)
    or exists (select 1 from public.evidence e
                where e.file_path = name and e.policy_id is not null and public.can_read_practice(e.practice_id))));
drop policy if exists evidence_obj_insert on storage.objects;
create policy evidence_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'evidence' and (
    public.can_manage_practice(((storage.foldername(name))[1])::uuid)
    or (public.auth_role() = 'group_admin' and public.is_group_admin_of(((storage.foldername(name))[1])::uuid))
    or (public.auth_role() = 'staff' and public.auth_practice_id() = ((storage.foldername(name))[1])::uuid)));

-- ---------- every practice gets a copy of every policy ----------
create or replace function public.ensure_practice_policies(p_practice uuid) returns void
language sql security definer set search_path = public as
$$
  insert into public.evidence (practice_id, category, title, policy_id, body, template_version, current_version, status, uploaded_by)
  select pr.id, 'policies', p.title_en, p.id, replace(p.body_en, '{{practice}}', pr.name), p.version, p.version, 'pending', null
    from public.practices pr cross join public.policies p
   where pr.id = p_practice
  on conflict (practice_id, policy_id) where policy_id is not null do nothing;
$$;
revoke execute on function public.ensure_practice_policies(uuid) from public, anon, authenticated;

create or replace function public.practice_policies_trg() returns trigger
language plpgsql security definer set search_path = public as
$$ begin perform public.ensure_practice_policies(new.id); return new; end $$;
drop trigger if exists practice_policies_ins on public.practices;
create trigger practice_policies_ins after insert on public.practices
  for each row execute function public.practice_policies_trg();

create or replace function public.policy_copies_trg() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  insert into public.evidence (practice_id, category, title, policy_id, body, template_version, current_version, status, uploaded_by)
  select pr.id, 'policies', new.title_en, new.id, replace(new.body_en, '{{practice}}', pr.name), new.version, new.version, 'pending', null
    from public.practices pr
  on conflict (practice_id, policy_id) where policy_id is not null do nothing;
  return new;
end $$;
drop trigger if exists policy_copies_ins on public.policies;
create trigger policy_copies_ins after insert on public.policies
  for each row execute function public.policy_copies_trg();

-- ---------- the dashboard score ignores policy copies that have not been adopted ----------
create or replace function public.practice_inputs(p_practice uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare aid uuid; res jsonb; r public.user_role;
begin
  if not public.can_read_practice(p_practice) then raise exception 'Not permitted'; end if;
  r := public.auth_role();
  if r in ('group_admin','inspector','platform_admin') then
    perform public.log_event('view_dashboard','practice',p_practice::text,p_practice,'{}'::jsonb);
  end if;
  select id into aid from public.assessments
   where practice_id = p_practice and status = 'completed' and kind = 'hiw' order by completed_at desc limit 1;
  select jsonb_build_object(
    'practice', (select to_jsonb(p) from public.practices p where p.id = p_practice),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object(
                  'category',category,'status',status,'expiry_date',expiry_date))
                  from public.evidence where practice_id = p_practice
                    and (policy_id is null or adopted_at is not null)), '[]'::jsonb),
    'assessment', case when aid is null then null else jsonb_build_object(
        'id', aid,
        'completed_at', (select completed_at from public.assessments where id = aid),
        'answers', coalesce((select jsonb_agg(jsonb_build_object('category',q.category,'answer',a.answer))
                    from public.assessment_answers a
                    join public.assessment_questions q on q.id = a.question_id
                    where a.assessment_id = aid), '[]'::jsonb)) end,
    'training', coalesce((select jsonb_agg(jsonb_build_object('kind',m.kind,'status',t.status))
                  from public.training_assignments t
                  join public.training_modules m on m.id = t.module_id
                  where t.practice_id = p_practice), '[]'::jsonb),
    'staff_count', (select count(*) from public.profiles
                     where practice_id = p_practice and active and role in ('staff','practice_manager','principal')),
    'pm_trained', exists (select 1 from public.training_assignments t
                  join public.training_modules m on m.id = t.module_id
                  where t.practice_id = p_practice and m.kind = 'pm' and t.status = 'completed'),
    'snapshots', coalesce((select jsonb_agg(jsonb_build_object('taken_on',taken_on,'score',score) order by taken_on)
                  from public.compliance_snapshots
                  where practice_id = p_practice and taken_on > current_date - 190), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- ---------- the master policy library (platform admin edits these) ----------
insert into public.policies (ref, folder, title_en, title_cy, body_en) values
($POL$POL01$POL$, $POL$Governance$POL$, $POL$Complaints policy$POL$, $POL$Polisi cwynion$POL$, $POL$## Purpose
{{practice}} wants to hear when something has not gone as it should. This policy makes sure every concern is listened to, recorded, investigated fairly and used to improve care.

## Scope
Applies to all staff and to every complaint or concern, whether made in person, by phone, in writing, by e-mail or through a representative, in English or Welsh.

## Legal and regulatory basis
- NHS patients: The NHS (Concerns, Complaints and Redress Arrangements) (Wales) Regulations 2011 ("Putting Things Right").
- Private patients: The Private Dentistry (Wales) Regulations 2017 and the practice's own complaints procedure.
- GDC Standards for the Dental Team, Principle 5 (handle complaints effectively).

## Responsibilities
- Complaints lead: [name and role]. Deputy: [name and role].
- The lead makes sure every member of staff knows how to receive a complaint, and that the procedure is displayed and given to patients on request.
- All staff must pass any concern, however informal, to the complaints lead the same day.

## Procedure
- Listen, apologise where appropriate, and offer to resolve the matter straight away if it can be done. Record it even if it is resolved on the spot.
- Acknowledge a formal complaint within 2 working days.
- Investigate fairly, speak to those involved and review the clinical record.
- Send a full written response within [30 working days for NHS complaints / confirm the timescale for private complaints]. If more time is needed, explain why and keep the person updated.
- Explain how to take the matter further: for NHS care, the health board's Putting Things Right team, then the Public Services Ombudsman for Wales; for private care, the Dental Complaints Service or an independent adjudication body named in your procedure [name]. Give the contact details of Healthcare Inspectorate Wales (HIW) if the person wishes to raise a concern with the regulator.
- Offer a meeting or phone call if the person would prefer it. Offer information in Welsh, large print or other formats on request.

## Records and learning
- Every complaint and concern is entered in the complaints log: date, nature, who dealt with it, actions, outcome and date closed.
- Complaint records are kept separately from the clinical record, for at least [10] years.
- Themes are reviewed at the team meeting at least [quarterly] and learning is recorded.
- Where the complaint involves a patient safety incident, follow the duty of candour policy (POL16).

## Related documents
Duty of candour policy (POL16); Patient feedback policy (POL20); Raising concerns policy (POL02).

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL02$POL$, $POL$Governance$POL$, $POL$Raising concerns (whistleblowing) policy$POL$, $POL$Polisi codi pryderon (chwythu'r chwiban)$POL$, $POL$## Purpose
Staff are encouraged and expected to raise concerns about patient safety, malpractice or wrongdoing without fear of reprisal. This policy explains how.

## Scope
Applies to all employees, associates, locums, agency staff, students, trainees and volunteers at {{practice}}.

## Legal and regulatory basis
- Public Interest Disclosure Act 1998 (protects workers who make a protected disclosure).
- GDC Standards for the Dental Team, Principle 8: raise concerns if patients are at risk.

## What to raise
Anything that puts patients, staff or the public at risk, including unsafe clinical practice, poor infection control, bullying or harassment, fraud, a breach of confidentiality, concealment of errors, or a failure to follow the law.

## How to raise a concern
- Speak first to [name and role] or to your line manager, in person or in writing.
- If that is not appropriate, because the concern is about them, speak to the Principal / Registered Manager [name].
- If you are still concerned, or feel unable to raise it internally, you may contact the General Dental Council, Healthcare Inspectorate Wales, or Protect (independent whistleblowing charity, free advice line). Contact details: [add].
- You may raise a concern anonymously, although this can make it harder to investigate.

## What the practice will do
- Acknowledge the concern within 5 working days.
- Decide who will investigate, treat the matter confidentially as far as possible, and keep the person informed of progress and outcome where the law allows.
- Take action if the concern is well founded, including reporting to the regulator where required.
- Protect anyone who raises a concern in good faith from victimisation. Retaliation against someone who has raised a concern is a disciplinary matter.

## Records
Concerns and outcomes are recorded in a confidential log, held by [name], and reviewed at least annually by the Principal to identify themes.

## Training
Included in staff induction and revisited at least annually at a team meeting.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL03$POL$, $POL$Safeguarding$POL$, $POL$Safeguarding children and adults policy$POL$, $POL$Polisi diogelu plant ac oedolion$POL$, $POL$## Purpose
To protect children and adults at risk of abuse, neglect or exploitation, and to make sure every member of the team knows what to do if they have a concern.

## Scope
Applies to all staff and to every patient and visitor, including children, young people, adults at risk and people who may lack mental capacity.

## Legal and regulatory basis
- Social Services and Well-being (Wales) Act 2014, including the duty to report.
- Wales Safeguarding Procedures (children and adults at risk) and the National Training Standards for safeguarding.
- Children Act 1989 and 2004; Mental Capacity Act 2005; Protection of Vulnerable Groups.
- GDC Standards for the Dental Team, Principle 8; Healthcare Inspectorate Wales expectations.

## Named people
- Safeguarding lead: [name and role], trained to [level required by Wales Safeguarding Procedures / National Training Standards].
- Deputy: [name and role].
- Local safeguarding contacts: [local authority safeguarding team telephone and e-mail]; out of hours: [number]; Health board dental safeguarding adviser: [name/contact].

## Recognising abuse and neglect
Be alert to physical, emotional, sexual or financial abuse, neglect, domestic abuse, honour-based abuse, female genital mutilation, forced marriage, radicalisation, child sexual exploitation, county lines, and self-neglect. In dentistry, signs may include untreated dental disease (dental neglect), repeated missed appointments, injuries to the head, face, mouth or neck, and a person who is fearful of a carer.

## What to do if you have a concern
- Make sure the person is safe. If someone is in immediate danger, call 999.
- Do not investigate or promise confidentiality. Listen, record the facts and the person's own words, and do not ask leading questions.
- Tell the safeguarding lead the same day. If the lead is not available, contact the local authority safeguarding team directly.
- Make a report to the local authority (a "report of an adult/child at risk") without delay, and confirm in writing within [24 hours / local timescale]. You do not need consent to report a child at risk; for adults at risk, seek consent where safe, but report anyway if the person lacks capacity or others may be at risk.
- Record decisions and reasons, including a decision not to refer.
- Share information on a "need to know" basis only, in line with the data protection and confidentiality policy (POL09).

## Recruitment and supervision
Enhanced DBS checks (including the barred list where the role allows) are carried out for all clinical and patient-facing staff, in line with the recruitment policy (POL13). Children and vulnerable adults are not left unsupervised with a member of staff; a chaperone is offered (POL18).

## Training
All staff complete safeguarding training at the level required for their role at induction and refresh it at least every [3] years, with updates at team meetings. Records are kept in the staff training matrix.

## Review
Reviewed at least annually and after any safeguarding incident.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL04$POL$, $POL$Infection control$POL$, $POL$Infection prevention and control policy$POL$, $POL$Polisi atal a rheoli heintiau$POL$, $POL$## Purpose
To reduce the risk of healthcare-associated infection to patients, staff and visitors at {{practice}}.

## Legal and regulatory basis
- Welsh Health Technical Memorandum WHTM 01-05 (decontamination in primary care dental practices) and Health Technical Memoranda referenced in it.
- The Health and Social Care Act 2008 Code of Practice on infection prevention (as a standard of good practice); Public Health Wales guidance.
- Health and Safety (Sharp Instruments in Healthcare) Regulations 2013; COSHH Regulations 2002.
- Health and Care Standards for Wales (NHS) / Private Dentistry (Wales) Regulations 2017.

## Responsibilities
- Infection prevention and control (IPC) lead: [name and role]. Deputy: [name].
- The lead keeps this policy up to date, runs the six-monthly audit, and makes sure staff are trained.
- All staff must follow standard precautions every time, and report any breach or sharps injury.

## Standard infection control precautions
- Hand hygiene using the 5 moments for hand hygiene, with the practice's hand-washing sinks, liquid soap, alcohol hand rub and single-use towels. Remove wrist and hand jewellery; keep nails short and clean; cover cuts with waterproof dressings.
- Personal protective equipment (PPE): gloves, mask, eye protection and apron for every procedure; change between patients.
- Safe handling and disposal of sharps (see sharps injury procedure below); do not re-sheath needles by hand unless a safety device is used.
- Environmental cleaning: surfaces and equipment cleaned and disinfected between patients; the cleaning schedule and colour-coding are in [location].
- Dental unit water lines: managed in line with WHTM 01-05 (flushing, disinfection regime, and water testing as per the Legionella risk assessment).
- Waste is segregated and disposed of in line with the waste policy (POL12).
- Laundry and uniforms: [describe].

## Immunisation and occupational health
All clinical staff are offered Hepatitis B vaccination and their antibody response is checked and recorded. Occupational health arrangements: [provider/contact]. Records of immunity are held confidentially in the staff file.

## Sharps injury / blood and body-fluid exposure
Immediately encourage bleeding, wash with soap and running water, cover with waterproof dressing, and report to [name]. Carry out a risk assessment, seek urgent advice from occupational health or the emergency department (within hours, for post-exposure prophylaxis), record the incident and the source patient (with consent), and complete a RIDDOR report if required.

## Audit and review
- IPC audit using the national audit tool every [six months]; results and actions are recorded and reviewed at the team meeting.
- Hand hygiene audit [at least annually].
- Policy reviewed annually.

## Training
Induction and refresher training on infection control for all staff, recorded in the training matrix (at least annually for the whole team).

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL05$POL$, $POL$Infection control$POL$, $POL$Decontamination policy (WHTM 01-05)$POL$, $POL$Polisi diheintio (WHTM 01-05)$POL$, $POL$## Purpose
To make sure all reusable instruments and equipment at {{practice}} are cleaned, disinfected and sterilised so they are safe for the next patient, and that every instrument can be traced.

## Legal and regulatory basis
- Welsh Health Technical Memorandum 01-05: Decontamination in primary care dental practices (and the Welsh edition's Best Practice and Essential Quality Requirements).
- Medical Devices Regulations; Pressure Systems Safety Regulations 2000; BS EN 13060 (sterilisers); BS EN ISO 15883 (washer-disinfectors).
- Healthcare Inspectorate Wales inspection themes.

## Responsibilities
- Decontamination lead: [name and role]. Deputy: [name].
- The lead keeps the decontamination records, arranges validation and servicing, and checks that staff doing decontamination are trained and competent.

## The decontamination cycle
- Transport: dirty instruments are carried to the decontamination room in a closed, lidded, labelled container.
- Pre-sterilisation cleaning: cleaning in a validated washer-disinfector in preference to manual cleaning; if manual cleaning is used, it is a documented, validated process with a dedicated sink, correct detergent and water temperature (not above 45 degrees C), and instruments are fully visually inspected afterwards under a magnifier and light.
- Sterilisation: using an automatic steriliser (autoclave) with an appropriate cycle for the load (type N, S or B as required for wrapped or hollow instruments).
- Packaging and storage: instruments are wrapped or pouched and dated; storage times are as set out in WHTM 01-05.
- Traceability: a record is kept to link a sterilised load to patients [or per process: batch record].
- Dirty and clean areas are physically separated; the decontamination room has controlled access.

## Testing and records (a logbook is kept for each machine)
- Daily: autoclave water supply, safety checks, steam penetration/helix test on first cycle (where required), automatic control test, printouts reviewed.
- Weekly: [soil test and other washer-disinfector tests].
- Quarterly / periodic: [periodic tests as set out by the validating engineer].
- Annual validation of autoclaves and washer-disinfectors by an authorised person and a written inspection of pressure systems by a competent person within the insurance period (no more than [14] months for the autoclave inspection).
- All records are kept for the retention period in the records policy [no less than 2 years for routine logs; validation records for the life of the machine].

## Training
All staff who carry out decontamination are trained, competent, and have their training recorded. Training is refreshed annually.

## Failures
If a steriliser or washer-disinfector fails a test, stop using it, quarantine affected loads, re-process, inform the lead, and record the incident and the action taken. If a possible patient exposure is identified, follow the duty of candour policy (POL16) and take advice from Public Health Wales.

## Audit
Decontamination is reviewed in the six-monthly infection prevention audit (POL04).

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL06$POL$, $POL$Radiation$POL$, $POL$Radiation protection policy (IR(ME)R)$POL$, $POL$Polisi diogelu rhag ymbelydredd (IR(ME)R)$POL$, $POL$## Purpose
To keep radiation exposures as low as reasonably practicable (ALARP) and to comply with the law at {{practice}}.

## Legal and regulatory basis
- The Ionising Radiation (Medical Exposure) Regulations 2017 (IR(ME)R 2017), applying in Wales as enforced by Healthcare Inspectorate Wales (HIW).
- The Ionising Radiations Regulations 2017 (IRR17), enforced by the Health and Safety Executive (HSE).
- GDC guidance and FGDP "Selection Criteria for Dental Radiography".

## Duty holders
- Employer / Legal Person: [name].
- Radiation Protection Supervisor (RPS): [name].
- Radiation Protection Adviser (RPA): [name, organisation, certificate number].
- Medical Physics Expert (MPE) where required (e.g. CBCT): [name].
- Referrer(s): [names]. Practitioner(s): [names]. Operator(s): [names].
Each person's responsibilities and scope of entitlement are set out in writing in the IR(ME)R employer's procedures and kept in [location].

## Notifications and documents held
- HSE notification of work with ionising radiation (or registration where required): [date, reference].
- Critical examination, acceptance test and commissioning reports for each X-ray set.
- Risk assessment (prior to commencement of work), local rules for each room, and a written list of the RPS's duties.
- Employer's procedures and protocols for each type of exposure, and written referral criteria.

## Principles
- Justification: every exposure is justified in advance by a practitioner on an individual basis, and the justification is recorded.
- Optimisation: the lowest dose that gives the diagnostic information, using the right technique, collimation, rectangular collimation, fast film or digital sensors and appropriate exposure settings.
- Limitation of dose for staff and members of the public.
- Pregnancy: ask all patients of child-bearing age; record the answer.

## Patient exposures
- Patient identification is carried out before every exposure.
- Each radiograph is graded (A/B/C or 1/2/3) and a report with clinical findings is written in the record.
- Diagnostic reference levels are used and reviewed at [intervals] and doses are audited.
- Retakes are recorded and reviewed.

## Quality assurance and equipment
- A written quality assurance programme: critical examination, acceptance test, routine tests, an RPA survey at installation and at least every [3 years], plus after any repair or change.
- An inventory of equipment is kept.
- Local rules are displayed at the controlled area, and staff sign to say they have read them.

## Staff and training
- Staff who take or report radiographs hold IR(ME)R core of knowledge training and keep their CPD up to date (GDC requires radiography CPD for registrants who take radiographs).
- Dosimetry: [staff monitored by dosemeters / assessed as not requiring monitoring, per RPA advice].

## Audit and incidents
- Radiograph quality audit at least [annually], with action plans.
- Incidents and near misses involving radiation are reported to the employer and, where they meet the criteria, notified to HIW (patient overexposure) or HSE (IRR17 incidents).

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL07$POL$, $POL$Health & safety$POL$, $POL$Medical emergencies and resuscitation policy$POL$, $POL$Polisi argyfyngau meddygol ac adfywio$POL$, $POL$## Purpose
To make sure every member of the team at {{practice}} can recognise and respond effectively to a medical emergency.

## Legal and regulatory basis
- Resuscitation Council UK Quality Standards for cardiopulmonary resuscitation and training in primary dental care, and the Resuscitation Council UK guidelines for medical emergencies in dental practice.
- GDC Standards for the Dental Team, Principle 7 (staff trained to handle medical emergencies, equipment available).
- Health and Safety (First-Aid) Regulations 1981.

## Responsibilities
- Emergency lead: [name and role]; deputy: [name]. First aider(s): [names, certificates].
- The lead checks the emergency drugs and equipment, books training and keeps records.

## Emergency equipment and drugs
Held in one place that everyone knows, at: [location]. The kit contains at least:
- Oxygen cylinder with a mask and tubing (adult and child), portable suction, pocket mask, self-inflating bag-valve-mask.
- Automated external defibrillator (AED), with pads (adult and paediatric as appropriate): location [ ].
- Emergency drugs: adrenaline (epinephrine) 1 mg/mL injection, glucagon injection, GTN spray, salbutamol inhaler with spacer, aspirin 300 mg dispersible tablets, oral glucose (gel or tablets), midazolam buccal/intranasal for seizures (where held; see the medicines policy POL21).
- Blood glucose meter, oropharyngeal airways, syringes and needles, and a copy of the protocols and an incident record form.

## Checks
- Weekly check of the oxygen, AED, drugs, expiry dates and sealed kit, recorded in the log.
- Replace any item that has been used or is within [one month] of expiry immediately.
- Annual servicing of the AED and oxygen equipment, as per the manufacturer.

## Procedure in an emergency
- Stay calm, call for help, and follow the ABCDE approach. The most senior clinician leads; one person is told to call 999 if help is needed (give the address and state clearly that a medical emergency is in progress).
- In cardiac arrest, start CPR (30:2) and fetch the AED. Continue until the paramedics arrive.
- Record the event (time, actions, drugs, outcome) at the time and review it as a significant event.

## Training
- All clinical and non-clinical staff complete basic life support (BLS) and AED training at least annually, with scenario-based practice of medical emergencies at least [every 6 months]. Dentists and DCPs also meet GDC CPD requirements in medical emergencies.
- Training records are kept in the training matrix.

## Review
After any use of the emergency kit and at least annually.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL08$POL$, $POL$Health & safety$POL$, $POL$Health, safety and fire policy$POL$, $POL$Polisi iechyd, diogelwch a thân$POL$, $POL$## Purpose
To provide a safe place for patients, staff and visitors at {{practice}}, and to comply with health and safety and fire law.

## Legal and regulatory basis
- Health and Safety at Work etc. Act 1974; Management of Health and Safety at Work Regulations 1999.
- COSHH Regulations 2002; Manual Handling Operations Regulations 1992; Provision and Use of Work Equipment Regulations 1998 (PUWER); Display Screen Equipment Regulations 1992; Electricity at Work Regulations 1989; Pressure Systems Safety Regulations 2000.
- Health and Safety (Sharp Instruments in Healthcare) Regulations 2013; RIDDOR 2013; Control of Legionella (ACoP L8).
- Regulatory Reform (Fire Safety) Order 2005; Employers' Liability (Compulsory Insurance) Act 1969.
- Health and Safety Executive, Public Health Wales and HIW guidance.

## Responsibilities
- The employer / Principal is responsible for health and safety: [name].
- Health and safety lead: [name]. Fire safety responsible person: [name]. Fire marshal(s): [names].
- All staff must take reasonable care, follow safe working practices and report hazards and incidents.

## Risk assessments (reviewed at least annually, or after any change or incident)
General workplace; COSHH (including dental materials, mercury, acids, latex, disinfectants); manual handling; display screen equipment; sharps; lone working (POL18); new and expectant mothers; young workers; legionella; fire; stress and wellbeing; violence and aggression.

## Fire safety
- A written fire risk assessment, reviewed annually by [competent person].
- Fire detection and alarm system tested weekly and serviced [six-monthly]; emergency lighting tested monthly and serviced annually; fire extinguishers serviced annually.
- Escape routes and fire exits are kept clear and signed; a fire plan and assembly point at [ ] is displayed.
- A fire drill is carried out at least every [six months], and recorded. All staff have fire safety training at induction and annually.
- Arrangements for patients and staff who need help to leave the building (personal emergency evacuation plans).

## Other statutory checks (see the practice's maintenance register)
Gas safety (annual), fixed electrical installation (every 5 years), portable appliance testing (as risk assessed), pressure vessels and compressors (every 14 to 26 months), legionella checks (monthly temperatures, annual risk assessment review), water tank cleaning.

## Accidents and incidents
All accidents, near misses and incidents are recorded in the accident book. RIDDOR-reportable events are reported to the HSE. First aider(s) and the first-aid box are located at [ ].

## Insurance and notices
Employer's liability insurance certificate and the health and safety law poster are displayed at [location].

## Training
Induction health and safety training for all staff, with annual refresher training (manual handling, fire, COSHH, sharps) recorded in the training matrix.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL09$POL$, $POL$Information governance$POL$, $POL$Data protection and confidentiality policy$POL$, $POL$Polisi diogelu data a chyfrinachedd$POL$, $POL$## Purpose
To protect the personal information of patients and staff held by {{practice}}, to keep it confidential, and to comply with data protection law.

## Legal and regulatory basis
- UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
- Common law duty of confidentiality; Human Rights Act 1998 (Article 8).
- GDC Standards for the Dental Team, Principle 4 (maintain and protect patients' information).
- Records Management Code of Practice for Health and Social Care (as applied in Wales).

## Roles
- Data controller: {{practice}}, registered with the Information Commissioner's Office (ICO), registration number [ ]. Fee renewed each year on [date].
- Data protection lead / DPO (if appointed): [name and contact]. All staff are responsible for following this policy.

## Principles we follow
Personal data must be processed lawfully, fairly and transparently; collected for specified purposes; adequate and relevant; accurate; kept no longer than necessary; and kept secure.

## Lawful basis and privacy notice
- Our lawful bases and conditions for processing health data are set out in our privacy notice [link/location], which is given or displayed to every patient, in English and Welsh, and covers staff separately.
- We do not rely on consent to process health records for treatment; we do seek consent for marketing and for photographs or case studies.

## Confidentiality
- Patient information is shared only with those who need it for the person's care, or where the patient has consented, or where the law requires or the public interest justifies it (for example, safeguarding).
- Do not discuss patients in public areas; screens and paper records are kept out of view; reception conversations are managed to protect privacy.
- Nobody accesses a record without a work reason. Access is logged.

## Patient rights
Requests to see, correct, delete, restrict or move information are logged on the day they arrive and answered within one month, free of charge. The patient's identity is checked first. Contact the data protection lead immediately.

## Security
See the information security policy (POL19). Records are stored in [system/provider], with access control, encryption, backup, and a retention schedule.

## Retention
Clinical records: at least 11 years for adults; for children, until age 25 (or 26 if 17 at the end of treatment). Staff files: [period]. Finance and accounts: [period]. Confirm retention periods against the current Records Management Code of Practice. Destruction is secure and recorded.

## Breaches
Any loss, theft, mis-sending or unauthorised access is reported to the data protection lead at once, recorded, and assessed. Breaches likely to result in a risk to people's rights are reported to the ICO within 72 hours, and affected people are told without delay when the risk is high.

## Training
All staff receive data protection and confidentiality training at induction and at least annually, and sign a confidentiality statement.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL10$POL$, $POL$Clinical$POL$, $POL$Consent and mental capacity policy$POL$, $POL$Polisi cydsyniad a galluedd meddyliol$POL$, $POL$## Purpose
To make sure every patient at {{practice}} is given the information they need, and gives valid consent, before any examination, treatment or sharing of their information.

## Legal and regulatory basis
- Montgomery v Lanarkshire Health Board [2015] (material risks and reasonable alternatives).
- Mental Capacity Act 2005 and its Code of Practice (and Deprivation of Liberty Safeguards where relevant); Children Act 1989 (and Gillick competence).
- GDC Standards for the Dental Team, Principle 3 (obtain valid consent); HIW inspection themes.

## Principles
- Every adult is presumed to have capacity unless shown otherwise.
- Consent must be voluntary, informed and given by a person with capacity, and it can be withdrawn at any time.
- Consent is specific to the procedure; it is a process, not just a signature.

## Giving information
Before treatment, explain in plain language (in English or Welsh, with an interpreter or translated material if needed): the diagnosis, the proposed treatment and the reasons for it, the likely benefits, the material risks and complications, the reasonable alternatives (including no treatment), the likely costs, and any follow-up needed. Provide written estimates and treatment plans.

## Recording consent
Note in the clinical record what was explained, the patient's questions and decisions, and the date. Use a signed consent form for complex, higher-risk or irreversible treatment, sedation, or general anaesthesia (see POL17). Re-confirm consent if the plan changes.

## Capacity
- Assess capacity decision by decision, using the two-stage test: is there an impairment of mind or brain, and if so can the person understand, retain, use or weigh the information, and communicate a decision?
- Give all practicable help to support the decision first (time, format, supporters).
- If the person lacks capacity for this decision, treat only in their best interests, consulting those close to them, any attorney under a Lasting Power of Attorney or a court-appointed deputy, and any advance decision. Record the assessment and the reasons.

## Children and young people
- Under-16s may consent if competent (Gillick competence); otherwise a person with parental responsibility must consent. Over 16s are presumed able to consent.
- Check who has parental responsibility if a separated parent or another adult attends.

## Complaints and refusal
- A patient may refuse treatment. Record the discussion and offer alternatives. Do not coerce.
- Record any refusal and advise them of the consequences.

## Training
All clinical staff are trained in consent and capacity at induction and every [3] years, and in the Mental Capacity Act as part of safeguarding training.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL11$POL$, $POL$Governance$POL$, $POL$Equality, diversity and Welsh language (Active Offer) policy$POL$, $POL$Polisi cydraddoldeb, amrywiaeth a'r Gymraeg (Cynnig Rhagweithiol)$POL$, $POL$## Purpose
{{practice}} will treat all patients, staff and visitors with dignity and respect, will provide equal access to care, and will make an Active Offer of services in Welsh.

## Legal and regulatory basis
- Equality Act 2010 (protected characteristics: age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, sexual orientation).
- Welsh Language (Wales) Measure 2011 and the Welsh Government's "More than just words" Active Offer framework for health and social care.
- Human Rights Act 1998; GDC Standards for the Dental Team, Principle 1 (put patients' interests first) and Principle 9 (maintain, develop and work within your professional knowledge).

## Responsibilities
- Equality and Welsh language lead: [name and role].
- Everyone must follow this policy; discrimination, harassment, bullying and victimisation are not tolerated and are disciplinary matters.

## Patients
- Access: reasonable adjustments are made for patients with disabilities (step-free access, hearing loop, accessible toilet, longer appointments, easy-read information, assistance dogs welcome). The practice's accessibility audit is held at [location] and reviewed annually.
- Communication: information is given in formats and languages the patient can understand; interpretation and translation services are available through [provider].
- Dignity: privacy for conversations and for treatment; chaperone offered (POL18); respect for religion, belief, gender identity and cultural needs.
- Records of reasonable adjustments are recorded in the patient record.

## Welsh language: the Active Offer
- Welsh speakers are offered services in Welsh without having to ask. A Welsh speaker is identified on the appointment system and offered a Welsh-speaking clinician or reception staff member wherever possible.
- The "Iaith Gwaith" badge or "Cymraeg" lanyard is used by staff who speak Welsh; bilingual signage, letters, forms and the practice website are in English and Welsh and of equal prominence.
- A record of patients' language preference is kept.
- Staff are encouraged to learn Welsh; the practice will support learning through [provider/course].

## Staff
- Recruitment and promotion are fair and based on merit; vacancies state whether Welsh is essential or desirable.
- Staff are treated equally in pay, development and conditions. Reasonable adjustments are made for disabled staff.
- Bullying and harassment: complaints are dealt with under the grievance procedure and the raising concerns policy (POL02).

## Monitoring
Equality data is [collected and reviewed annually]; patient feedback is analysed by language and protected characteristic where possible.

## Training
Equality, diversity and inclusion training at induction and at least every [3] years; awareness of the Active Offer at induction.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL12$POL$, $POL$Health & safety$POL$, $POL$Waste management policy$POL$, $POL$Polisi rheoli gwastraff$POL$, $POL$## Purpose
To make sure all waste produced at {{practice}} is segregated, stored, transported and disposed of safely and legally.

## Legal and regulatory basis
- Environmental Protection Act 1990 (duty of care); Hazardous Waste (Wales) Regulations 2005; the Waste (Wales) legislation that applies to your site.
- Welsh Health Technical Memorandum on the safe management of healthcare waste (HTM 07-01 / WHTM 07-01 as applicable).
- Mercury Regulation (EU) 2017/852 as retained in UK law (amalgam separators; dental amalgam use).
- Carriage of Dangerous Goods regulations (ADR) where relevant; COSHH 2002.

## Responsibilities
- Waste lead: [name]. All staff must segregate waste correctly at the point of use.
- Waste contractors are registered carriers, and the practice keeps contracts, waste transfer or consignment notes and the carrier's registration for the retention period.

## Segregation (check the current colour code with your waste contractor)
- Infectious clinical waste: orange bag/bin for items contaminated with blood or body fluids [HTM 07-01 colour code].
- Offensive/hygiene waste (non-infectious, e.g. gloves and tissues that are not contaminated): yellow and black striped bag where required by the local contractor.
- Sharps: sharps container conforming to the standard; use the colour for the type of waste (for example, orange lid for sharps not contaminated with medicines; yellow lid for sharps contaminated with medicines, including local anaesthetic cartridges) [confirm with your waste contractor].
- Dental amalgam waste: collected in a labelled, airtight container (waste code 18 01 10*), including from chairside traps and the amalgam separator; collected by an authorised hazardous waste carrier.
- Extracted teeth: handled as anatomical waste or returned to the patient on request; teeth with amalgam are amalgam waste.
- Pharmaceutical, X-ray developer and fixer chemicals, and any lead foil are hazardous waste and must not go down the drain.
- General domestic waste and recycling [describe].

## Storage and transport
- Waste is stored in a secure, labelled, locked area (not accessible to the public) until collection, and for no longer than [the period in the contract/guidance].
- Containers are closed when three-quarters full, sealed and labelled with the practice name and date.

## Records
Keep waste transfer notes for at least 2 years, hazardous waste consignment notes for at least 3 years, and amalgam separator maintenance records for [period set by the manufacturer / your retention schedule].

## Sharps and spills
Needle-stick and sharps safety are covered in POL04. Spillages (including mercury) are managed using the spill kit, with the incident recorded.

## Training
Included in induction and refreshed annually in infection control and health and safety training.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL13$POL$, $POL$Staffing$POL$, $POL$Recruitment, DBS and induction policy$POL$, $POL$Polisi recruitio, DBS a sefydlu$POL$, $POL$## Purpose
To recruit, check and induct staff fairly and safely at {{practice}}, so only suitable people provide care.

## Legal and regulatory basis
- Private Dentistry (Wales) Regulations 2017 (fit persons, recruitment and staff checks); Health and Care Standards; GDC registration requirements.
- Equality Act 2010; Asylum and Immigration Act (right-to-work checks); Rehabilitation of Offenders Act 1974; Safeguarding Vulnerable Groups Act 2006; Data Protection Act 2018.
- Disclosure and Barring Service (DBS) Code of Practice.

## Responsibilities
Recruiting manager: [name]. The Registered Manager approves each appointment.

## Pre-employment checks (completed before the start date, or before any unsupervised work)
- Identity and right to work in the UK (copies of documents seen, dated and signed).
- Enhanced DBS certificate (with the barred list check for roles that allow it) for all clinical and patient-facing staff, or evidence of a recent update service check; a risk assessment is written if any information on the certificate is disclosed.
- Two written references, including the most recent employer, followed up by phone where necessary; explain any employment gaps.
- Professional registration: GDC (or other regulator) registration verified on the register, with the date checked and recorded; indemnity cover (dental indemnity or insurance) confirmed in date.
- Qualifications, immunisation status (Hepatitis B and evidence of antibody response for clinical staff), and fitness for work/occupational health clearance.
- Language skills (including Welsh where required) and any required statements of health.

## Contracts and induction
- A written contract or terms of engagement, a job description, and the staff handbook are provided before or on the start date.
- Induction covers: introduction to the team and premises; fire safety and emergency procedures; health and safety; infection control and decontamination; safeguarding; medical emergencies (BLS); data protection and confidentiality; complaints and raising concerns; equality and Welsh language; local rules for radiation (where relevant); this policy library, and how to confirm you have read them. A signed induction checklist is kept in the staff file.
- Probation reviews at [one, three, six months].

## Ongoing
- Annual appraisal and personal development plan (POL22), with training records kept up to date.
- DBS checks are renewed or the update service checked at least every [3] years, and registration/indemnity checked annually.
- Staff are required to tell the practice at once of any caution, conviction, regulatory investigation or health condition that may affect fitness to practise.

## Records
A staff file is held for each person (kept in the HR section of this portal) in line with the data protection policy (POL09). Retain staff records for [6] years after employment ends [or as set out in your retention schedule].

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL14$POL$, $POL$Clinical$POL$, $POL$Clinical record keeping policy$POL$, $POL$Polisi cadw cofnodion clinigol$POL$, $POL$## Purpose
To make sure clinical records at {{practice}} are accurate, complete, legible, up to date and held securely, so that care is safe and decisions can be shown.

## Legal and regulatory basis
- GDC Standards for the Dental Team, Principle 4 (maintain and protect patients' information); FGDP guidance on clinical examination and record keeping.
- UK GDPR and the Data Protection Act 2018; Access to Health Records.
- Private Dentistry (Wales) Regulations 2017 (patient records).

## Responsibilities
- Records lead: [name]. Each clinician is personally accountable for the quality of their own records.

## What each record must contain
- Patient identity: full name, date of birth, address, contact details, and the name and details of the registered GP where relevant.
- A medical history, updated at every course of treatment and at least [annually], signed or confirmed by the patient, including allergies, medication and any change; and any social history (smoking, alcohol, sugar intake) where relevant.
- Presenting complaint, full clinical examination (extra-oral, intra-oral, soft tissues including oral cancer screening, periodontal assessment, basic periodontal examination (BPE) scores, caries risk, tooth wear).
- Radiograph justification and report, and its quality grading (POL06).
- Diagnosis, treatment options, treatment plan, costs, and consent (POL10).
- Treatment provided: date, tooth/site, materials, batch numbers where required, local anaesthetic (type, amount, batch), and any complications.
- Preventive advice given, recall interval and its rationale, and referrals made.
- Follow-up arrangements, patient's instructions, and any communication or contact about a missed appointment.
- Records of chaperone offered/used, and of any adverse event or complaint handled (cross-referenced).

## Standards for entries
- Entries are contemporaneous (made at the time or as soon as possible afterwards), dated and timed, and identify the author.
- Use clear language and agreed abbreviations only; opinions are professional and objective.
- Never alter an entry to change its meaning; corrections are made by a dated addendum.
- Digital records have an audit trail. Passwords are never shared, and users lock screens when away (POL19).

## Storage, access and retention
See POL09 and POL19. Records are backed up, held securely, and kept for at least 11 years for adults, and for children until age 25 (or 26 if 17 at the end of treatment). Records are transferred promptly and safely if a patient moves.

## Audit
A sample of records is audited at least [annually] against this policy and the results are discussed with each clinician; actions are recorded.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL15$POL$, $POL$Governance$POL$, $POL$Business continuity policy$POL$, $POL$Polisi parhad busnes$POL$, $POL$## Purpose
To keep patients safe and the practice running, or to restore it quickly, if something disrupts normal operation at {{practice}}.

## Scope and regulatory basis
- Applies to the whole practice and to every location it operates from.
- Healthcare Inspectorate Wales expects a plan for the continuity of care; Civil Contingencies Act 2004 principles; Private Dentistry (Wales) Regulations 2017 (governance arrangements).

## Responsibilities
- Business continuity lead: [name]; deputy: [name]. The plan is reviewed at least annually and after any incident or exercise. A printed copy and a digital copy (held off-site) are kept at [locations].

## Key risks and responses (complete for your site)
- Loss of premises (fire, flood, structural damage, access): [alternative premises or reciprocal arrangement with [practice name]; patients are contacted and urgent care arranged].
- Loss of power, water, or gas: [back-up procedures; sterilisation and emergency treatment plans; stop elective work if infection control can't be assured].
- Failure of IT, internet, or telephones, including cyber attack: switch to paper records and downtime procedures; restore from backup; contact the IT supplier [number]; report to the ICO within 72 hours if personal data is compromised (POL19).
- Loss of key staff (illness, strike, severe weather): locum arrangements, cancellation priorities, and who can deputise.
- Loss of a supplier or equipment (compressor, autoclave, X-ray): back-up equipment or service contract [details].
- Pandemic or outbreak of infectious disease: follow Public Health Wales and Welsh Government guidance; adjust triage, PPE and appointments.
- Medical or other emergencies on-site: see POL07.

## Emergency contacts
Keep a current list of: the Principal/Registered Manager; staff contact numbers; utilities; IT and telephone providers; landlord/building manager; insurance broker; the local health board dental contact [ ]; HIW [contact]; and nearest alternative dental practice [ ].

## Communication
Decide who tells patients, staff and the regulator, in what order, and how: telephone message, website banner, text/e-mail, and local health board contacts. Provide emergency dental care contact details (111, local out-of-hours service) to patients.

## Notifications
HIW must be told of events that affect the running of a registered service (for example, serious incidents, fire, or an extended closure). The practice records what was notified, when and by whom [reference].

## Testing
The plan is tested by a desktop exercise at least [annually]; learning and updates are recorded. Backups are restored as a test at least [every 6 months].

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL16$POL$, $POL$Governance$POL$, $POL$Duty of candour and incident reporting policy$POL$, $POL$Polisi dyletswydd gonestrwydd ac adrodd am ddigwyddiadau$POL$, $POL$## Purpose
To make sure that when something goes wrong with a patient's care at {{practice}}, we are open and honest, say sorry, put it right where possible, and learn from it.

## Legal and regulatory basis
- GDC Standards for the Dental Team, Principle 5 (be open and honest when things go wrong; the professional duty of candour).
- NHS Wales duty of candour and the Putting Things Right arrangements where they apply to NHS care [confirm with your health board]; Private Dentistry (Wales) Regulations 2017 (incident and notification requirements).
- Healthcare Inspectorate Wales notification requirements for registered services.

## Responsibilities
- Incident and candour lead: [name and role].
- Every member of staff must report incidents and near misses promptly and honestly.

## What to report
- Patient safety incidents (wrong tooth, wrong drug or dose, an avoidable injury, a retained instrument or fragment, a sterilisation failure that might affect patients, a significant medical emergency, a data breach affecting a patient, a serious delay in diagnosis).
- Near misses (an error caught before it reached the patient).
- Staff accidents (see POL08) and any event that led or could have led to harm.

## What to do straight away
- Make the patient safe and get any treatment needed.
- Tell the lead the same day.
- Preserve evidence and complete an incident report: date, what happened, who was involved, harm, and immediate actions.

## Being open
- Tell the patient (or the person acting for them) as soon as possible: what happened, what we know and don't know, what we will do to put it right, and how we will keep them informed.
- Apologise sincerely (an apology is not an admission of liability). Follow up in writing, and offer a meeting.
- Record the discussion in the clinical record and the incident log.

## Investigation and learning
- Investigate proportionately; for more serious incidents, carry out a root cause analysis involving the whole team.
- Actions, owners and dates are recorded and followed up.
- Shared learning is discussed at the team meeting, and themes are reviewed at least [quarterly].

## Notifications
Serious incidents, deaths, and any event that meets the regulator's reporting criteria are notified to HIW [and the health board/NHS body, ICO, HSE (RIDDOR), MHRA (devices/medicines) as appropriate] within the required time. Keep a record of what was notified, when, by whom and the acknowledgement.

## Training
Included in induction and refreshed annually; the lead completes complaints and incident-handling training.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL17$POL$, $POL$Clinical$POL$, $POL$Sedation policy$POL$, $POL$Polisi tawelu ymwybodol$POL$, $POL$## Purpose
To make sure that, where {{practice}} offers sedation, it is provided safely, by trained people, with the right equipment and monitoring. If the practice does not offer sedation, record that here and keep the policy for reference.

## Legal and regulatory basis
- Standards for Conscious Sedation in the Provision of Dental Care (Intercollegiate Advisory Committee for Sedation in Dentistry, IACSD).
- GDC Standards for the Dental Team and the GDC's guidance on sedation; Private Dentistry (Wales) Regulations 2017 (registration of sedation as a regulated activity).
- Medicines Act and Misuse of Drugs Regulations (as applicable to the sedative agent).

## Scope
Applies to minimal and moderate sedation by inhalation (nitrous oxide), oral, intranasal or intravenous routes, provided at {{practice}}. General anaesthesia is not provided in this practice.

## Responsibilities
- Sedation lead: [name and qualification]. Operator-sedationist(s): [names]. Sedation assistants: [names].
- Registrations, indemnity cover and training certificates are held in each person's file.

## Patient selection and assessment
- Assess the patient before the day: medical, dental, social, airway and anxiety assessment; ASA grading; consider whether sedation is appropriate or if referral is needed.
- Obtain written consent for sedation (POL10) after discussion of the options and risks. Give written pre- and post-operative instructions, in English and Welsh, in good time.
- An escort is required for the journey home and 24 hours of supervision after sedation.

## Staffing, equipment and facilities
- Two appropriately trained members of the team are present for the entire procedure, including an operator-sedationist and a second person who is trained and has current immediate life support (or paediatric equivalent for children). The second person monitors the patient, and records observations.
- Monitoring: pulse oximetry at all times; blood pressure, heart rate and consciousness level at intervals; capnography where intravenous or deeper sedation is used.
- Emergency drugs and equipment, including oxygen, suction, airway adjuncts, bag-valve-mask, and sedation reversal agents (for example, flumazenil if benzodiazepines are used) are immediately to hand and checked weekly (POL07).
- A recovery area with monitoring, and the same standard of dignity and privacy.

## Records
A sedation record is kept for each patient: assessment, consent, drugs, doses, route and times, monitoring and observations, treatment, recovery, discharge criteria met, and instructions given.

## Discharge
Patients are discharged only when the discharge criteria are met, to a responsible adult escort, with written instructions and an emergency contact number.

## Training and review
- All sedation staff complete immediate life support (or equivalent) and sedation training, with annual updates, and log their CPD.
- Annual audit of sedation episodes, adverse events and patient feedback; the policy is reviewed annually.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL18$POL$, $POL$Health & safety$POL$, $POL$Lone working and chaperone policy$POL$, $POL$Polisi gweithio ar eich pen eich hun a chaperonau$POL$, $POL$## Purpose
To protect staff who sometimes work alone at {{practice}} or off-site, and to protect patients and staff by offering a chaperone where appropriate.

## Legal and regulatory basis
- Health and Safety at Work etc. Act 1974 and the Management of Health and Safety at Work Regulations 1999 (risk assessment for lone workers).
- GDC Standards for the Dental Team (patients' dignity and the offer of a chaperone); HIW inspection themes on dignity and respect.

## Responsibilities
- Lead: [name and role]. All staff must follow the arrangements below.

## Lone working
- Lone working is avoided wherever practicable. Where it is unavoidable (for example, early or late sessions, a locum, or a domiciliary or care-home visit), a risk assessment is carried out and signed off by [name].
- Before working alone, a colleague or line manager knows the location and the expected finish time, and the person checks in by phone or text at [intervals]. If there is no check-in, the arrangements in the risk assessment (call, then visit, then emergency services) are followed.
- Premises are secure, with door controls, a panic alarm or other means of summoning help, and a telephone to hand.
- High-risk treatments (for example, sedation, extraction under stress, or a patient who is unwell) are not undertaken by a person working alone.
- Domiciliary visits: confirm the address and the patient's needs beforehand, take a charged phone, share the location, and do not enter if there is a risk to safety.
- Staff must report any incident of violence or aggression, which will be recorded and reviewed (POL08).

## Chaperone
- A chaperone is offered to any patient who would like one, particularly for intimate or sensitive examinations, or where the patient is a child, vulnerable or has communication needs. The offer is noted on a poster and recorded in the clinical record.
- A chaperone is a trained member of the team, who is not otherwise carrying out the treatment, and stays for the whole of the examination or treatment. They are not a family member unless the patient asks for them.
- If the patient declines a chaperone, record that. If a clinician feels one is needed, record the reason.
- A chaperone knows what the procedure involves, understands confidentiality, and reports any concern (POL03).

## Training
All staff are trained in the chaperone role at induction. Staff who work alone have personal safety training and know how to use the alarm.

## Review
The risk assessments and this policy are reviewed at least annually and after any incident.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL19$POL$, $POL$Information governance$POL$, $POL$Information security and cyber policy$POL$, $POL$Polisi diogelwch gwybodaeth a seiber$POL$, $POL$## Purpose
To protect the practice's computers, networks and the personal information they hold at {{practice}} from loss, damage or unauthorised access, and to be prepared for a cyber incident.

## Legal and regulatory basis
- UK GDPR (security of processing, Article 32) and the Data Protection Act 2018.
- Network and Information Systems and NHS data security requirements as applicable; NCSC Cyber Essentials guidance.
- Any assurance toolkit your NHS commissioner or health board requires [confirm].

## Responsibilities
- IT and information security lead: [name]. External IT supplier: [name, contact, contract].
- All users must follow this policy. Misuse can lead to disciplinary action.

## Controls
- Access: each person has their own login; passwords are strong (at least 12 characters or three random words) and are never shared or written down; multi-factor authentication is switched on where available (including for the portal and e-mail). Access is removed the same day a person leaves.
- Devices: computers, laptops and phones are encrypted, lock after a short time, and have up-to-date antivirus. Personal devices are used for work only under written permission [BYOD rules].
- Updates: operating systems, practice-management software and the firewall are patched within [14 days] of release; unsupported software is not used.
- Network: a firewall, a separate guest Wi-Fi, secure wireless with a strong key, and no unmanaged devices on the clinical network. Remote access is only through a secure VPN with MFA.
- E-mail and phishing: staff are trained to spot phishing and do not open unexpected attachments or links. Personal data sent by e-mail is encrypted or sent via a secure portal.
- Backups: clinical and financial data are backed up daily (3-2-1 rule: three copies, two media, one off-site and offline). Restores are tested at least [every 6 months].
- Removable media (USB sticks) is not used unless encrypted and authorised.
- Paper records and printouts are kept in a locked room or cabinet, and confidential paper waste is shredded.
- Physical security: server and network equipment are in a locked area; screens are positioned away from public view.

## Incident response
Report any suspected breach, loss or unusual activity at once to [name]. The lead isolates the affected device, contacts the IT supplier, records the incident, and decides whether the ICO (within 72 hours) and affected people must be told (POL09, POL15). Preserve logs and evidence.

## Training and review
All staff complete data security and cyber awareness training at induction and every year. A review of controls, supplier contracts and the asset register is carried out annually.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL20$POL$, $POL$Governance$POL$, $POL$Patient feedback and engagement policy$POL$, $POL$Polisi adborth ac ymgysylltu â chleifion$POL$, $POL$## Purpose
To listen to patients, find out how they experience {{practice}}, and use what we learn to improve.

## Legal and regulatory basis
- Health and Care Standards (Wales) 2023 (Quality Standards: person-centred care and listening and learning from feedback) and HIW expectations of patient feedback in inspections.
- Private Dentistry (Wales) Regulations 2017 (quality of services and patient views).
- GDC Standards for the Dental Team, Principle 2 (communicate effectively).

## Responsibilities
- Feedback lead: [name and role].

## How we gather feedback
- A short patient questionnaire (paper, QR code or text link, English and Welsh), offered to patients [at least every six months, or continuously]; a minimum of [20] responses are collected in each period.
- A comments box and a way to give feedback in person, by phone or on the practice website.
- Online reviews are read and responded to professionally, without revealing patient information.
- Targeted questions (for example, about accessibility, the Welsh Active Offer, waiting times or treatment explanations).

## What we do with it
- The lead summarises the results at least [every six months] and shares them with the team, noting what is working well and where we should improve.
- Actions are recorded with an owner and a date.
- We publish a "you said, we did" notice in the waiting room and on the website.
- Feedback is compared with complaints (POL01) to identify themes.

## Records
Questionnaires or a summary, the analysis, the action plan and the "you said, we did" notices are kept as evidence for [3] years.

## Confidentiality
Feedback is anonymous unless the patient chooses to identify themselves, and individuals are not identified in published results.

## Review
Reviewed annually. Survey questions are reviewed to ensure they remain useful.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL21$POL$, $POL$Clinical$POL$, $POL$Medicines management and antimicrobial prescribing policy$POL$, $POL$Polisi rheoli meddyginiaethau a phresgripsiynu gwrthficrobaidd$POL$, $POL$## Purpose
To make sure medicines are obtained, stored, prescribed, supplied, administered and disposed of safely at {{practice}}, and that antibiotics are used only when clinically needed.

## Legal and regulatory basis
- Human Medicines Regulations 2012; Misuse of Drugs Regulations 2001 (where any controlled drug is held); Medicines Act 1968.
- Faculty of General Dental Practice (FGDP) Antimicrobial Prescribing for General Dental Practitioners; Public Health Wales and the Welsh antimicrobial guidance; the British National Formulary (BNF) and the Dental Practitioners' Formulary.
- GDC Standards for the Dental Team, Principle 7; MHRA guidance on medicines safety and the Yellow Card scheme.

## Responsibilities
- Medicines lead: [name and role]. Prescribers: [names].

## Ordering, storage and security
- Medicines are ordered from approved suppliers and checked on delivery against the order.
- Stored in a locked cupboard or fridge, away from the public, at the correct temperature (fridge range 2 to 8 degrees C, with minimum and maximum temperature recorded daily).
- Expiry dates are checked at least [monthly] and expired or recalled medicines are removed, quarantined and disposed of through an authorised route.
- Prescription pads (e.g. FP10D) are stored securely, serial numbers recorded, and never pre-signed. Loss or theft is reported to the health board and police.
- Controlled drugs (if held) are stored in a locked cabinet, recorded in a register [if required], and reconciled [intervals].
- Emergency drugs are managed under POL07; sedation drugs under POL17.

## Prescribing and supplying
- Prescribe only when clinically justified, following local antimicrobial guidance: treat the cause, use local measures and drainage first, and prescribe antibiotics only for signs of spreading infection or systemic involvement, with the right agent, dose, route and duration.
- Check allergies, interactions, pregnancy, and the patient's other medicines first; record the prescription (drug, dose, route, duration and reason) in the clinical record.
- Patients are given clear instructions and information on side effects; supply is labelled correctly if dispensed.
- Local anaesthetic cartridges: the type, dose and batch are recorded; cartridges are single patient use and kept in their original packs, not above [room temperature].

## Adverse reactions and alerts
- Suspected adverse drug reactions are reported through the MHRA Yellow Card scheme, and recorded in the clinical record.
- Medicines and device safety alerts (MHRA, Welsh Government) are checked [weekly], actioned and recorded.

## Audit and training
- Antibiotic prescribing is audited at least [six-monthly] and results are shared at the team meeting.
- Prescribers keep their knowledge up to date (CPD) and the whole team is told about this policy at induction.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL22$POL$, $POL$Staffing$POL$, $POL$Training, CPD and appraisal policy$POL$, $POL$Polisi hyfforddiant, DPP ac arfarnu$POL$, $POL$## Purpose
To make sure every member of the team at {{practice}} is trained, competent and up to date in their role, and that training is planned and recorded.

## Legal and regulatory basis
- GDC Enhanced CPD scheme: 100 hours of verifiable CPD per five-year cycle for dentists and 75 hours for dental care professionals, with a personal development plan and annual returns.
- GDC "Standards for the Dental Team" (Principle 8 and the CPD requirements) and the Private Dentistry (Wales) Regulations 2017 (training and supervision of staff).
- Health and Care Standards (Wales) 2023 (workforce).

## Responsibilities
- Training lead: [name and role]. Each registrant is responsible for their own CPD record.

## Mandatory and highly recommended training
All staff, as applicable to their role, have up-to-date training in:
- Basic life support and medical emergencies (annual, with practical practice).
- Infection prevention and control, and decontamination (annual).
- Safeguarding children and adults at risk (at the level for the role, refreshed every [3] years).
- Health and safety, fire safety (annual) and manual handling.
- Data protection and information security (annual).
- Radiography and radiation protection (for those who take or report radiographs).
- Consent and the Mental Capacity Act, complaints handling, duty of candour, oral cancer awareness, and equality, diversity and the Welsh Active Offer.
- Sedation, where provided (POL17).

## Planning and records
- A practice training plan and a staff training matrix show who is trained in what, when it expires, and what is due (the "Training" and "Staff compliance" sections of this portal).
- Certificates and records are retained in the staff file and as evidence.
- Training that is due within [30] days is flagged and booked; overdue items are escalated to the lead.

## Appraisal and supervision
- Each member of staff has an annual appraisal, with objectives and a personal development plan, and a mid-year review.
- New staff and trainees are supervised until their competence is signed off. Dental nurses in training are registered with the GDC.
- Competence of those undertaking specific tasks (for example, decontamination or taking radiographs) is assessed and recorded.

## Review
Reviewed annually, with the training budget and the plan.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$),
($POL$POL23$POL$, $POL$Governance$POL$, $POL$Clinical audit and quality improvement policy$POL$, $POL$Polisi archwilio clinigol a gwella ansawdd$POL$, $POL$## Purpose
To check how well {{practice}} is doing against recognised standards, and to make improvements where the standard is not met.

## Legal and regulatory basis
- Health and Care Standards (Wales) 2023; Private Dentistry (Wales) Regulations 2017 (assessing and monitoring the quality of services).
- GDC Standards for the Dental Team; GDC CPD requirements; Faculty of General Dental Practice (FGDP) and Welsh Government quality improvement guidance.

## Responsibilities
- Audit and quality lead: [name and role]. Each clinician takes part in audits relevant to their work.

## The audit programme
A written annual audit schedule sets out what is audited, by whom, and when. The practice's schedule includes:
- Infection prevention and control audit using the national tool: every [six months] (POL04).
- Decontamination: reviewed within the infection control audit (POL05).
- Radiograph quality and justification audit: at least [annually] (POL06).
- Clinical record keeping: at least [annually] (POL14).
- Antibiotic prescribing: at least [six-monthly] (POL21).
- Hand hygiene and PPE: [annually].
- Consent, medical history and patient safety: [annually].
- Waste management, patient feedback and complaints themes: [annually].
- Other areas identified from incidents, complaints or feedback.

## Method (plan-do-study-act)
- Plan: define the standard and the sample size.
- Do: collect the data using a standard form, and keep it anonymous.
- Study: compare the results with the standard, and identify why any gaps exist.
- Act: agree improvements, assign an owner and date for each, then re-audit to check the change worked (complete the audit cycle).

## Records and sharing
The audit schedule, completed forms, results, action plans and re-audit dates are kept as evidence in the audit section of this portal. Results are discussed at team meetings and recorded in the minutes. Audit also counts towards CPD where appropriate.

## Review
The schedule is reviewed annually and after any significant incident or complaint.

## Approval and review
- Approved by: [name and role]
- Date approved: [date]
- Next review due: [date]
- Template reference and version are shown in the portal. Update the version each time this policy changes so staff are asked to read it again.
$POL$)
on conflict (ref) do update set
  folder = excluded.folder, title_en = excluded.title_en, title_cy = excluded.title_cy,
  body_en = excluded.body_en, version = public.policies.version + 1, updated_on = current_date
  where public.policies.body_en is distinct from excluded.body_en;

-- ---------- give every existing practice its copies ----------
select public.ensure_practice_policies(id) from public.practices;
