-- CreateProjectModal's "create matching Drive folder" checkbox needs to insert the folder's
-- document row (tagged with the project's own id) BEFORE the project row itself exists — the
-- project's real id is generated client-side and reused for both, with the project created right
-- after. A hard FK on document.project_id makes that first insert fail outright (the referenced
-- project row doesn't exist yet), so this drops it — same trust-the-application-layer treatment
-- project.owner_employee_ids/member_employee_ids already get for their own id references.
ALTER TABLE document DROP FOREIGN KEY document_ibfk_2;
