-- Links a project to the Doc Vault folder created for it at creation time, so tasks added later
-- (with "สร้างโฟลเดอร์เอกสาร" checked) can nest their own folder inside the project's folder
-- instead of always dropping it at the Drive root.
ALTER TABLE project
  ADD COLUMN doc_folder_id VARCHAR(64) NULL;
