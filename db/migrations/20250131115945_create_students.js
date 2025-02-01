exports.up = function (knex) {
    return knex.schema.createTable("students", (table) => {
      table.uuid("student_id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.uuid("id").references("id").inTable("schools").onDelete("CASCADE");
  
      // Admission Details
      table.text("admission_type");
      table.date("date_of_admission");
      table.text("scholar_admission_number");
      table.text("class_of_admission");
      table.text("admission_session");
      table.text("previous_class");
      table.text("previous_school");
  
      // Personal Details
      table.text("student_name").notNullable();
      table.text("student_image");
      table.date("date_of_birth");
      table.text("gender");
      table.text("category");
      table.text("caste");
      table.text("nationality");
      table.text("religion");
      table.text("mother_tongue");
      table.text("aadhar_number");
      table.text("sssmid");
      table.text("family_sssmid");
      table.text("pen");
      table.text("apaar_id");
      table.text("primary_contact_number");
      table.text("whatsapp_number");
      table.text("current_address");
      table.text("permanent_address");
  
      // Bank Details
      table.text("bank_name");
      table.text("ifsc");
      table.text("account_holder_name");
      table.text("account_number");
  
      // Father, Mother, Guardian Details
      table.text("father_name");
      table.text("mother_name");
      table.text("guardian_name");
  
      table.timestamps(true, true);
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTable("students");
  };
  