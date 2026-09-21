-- Settings module's name/nickname-change-needs-approval flow reuses the existing change_request
-- system with a new entity type (see server/routes/change-requests.ts / employees.ts).
ALTER TABLE change_request MODIFY entity_type ENUM('project','project_task','employee') NOT NULL;
