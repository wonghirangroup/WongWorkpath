-- โครงการย่อย (type = 'SP') can now point at the top-level โครงการ (type = 'P') it belongs
-- under — ON DELETE SET NULL (not CASCADE) so deleting the parent doesn't take its sub-projects
-- down with it; they just fall back to showing no parent, same as any other optional reference in
-- this app (see e.g. project.created_by's own ON DELETE SET NULL).
ALTER TABLE project ADD COLUMN parent_project_id VARCHAR(20) NULL,
  ADD FOREIGN KEY (parent_project_id) REFERENCES project(id) ON DELETE SET NULL;
