const { pool } = require('../../config/db');

async function makeDemoCatalogITOnly() {
  if (!['development', 'test'].includes(process.env.NODE_ENV)) {
    throw new Error('Demo catalog changes are restricted to development/test environments.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: departments } = await client.query(
      `SELECT id FROM departments WHERE code = 'IT' AND is_active = TRUE LIMIT 1`
    );
    if (!departments[0]) throw new Error('The IT department is required.');
    const itDepartmentId = departments[0].id;

    // The local catalog is a single IT class. Keep course and offering IDs stable
    // so existing enrollments and feedback remain connected.
    const courseUpdate = await client.query(
      `UPDATE courses
       SET code = 'IT' || substring(code FROM 3)
       WHERE code ~ '^CS[0-9]+$'`
    );
    const offeringUpdate = await client.query(
      `UPDATE course_offerings SET department_id = $1 WHERE is_active = TRUE`,
      [itDepartmentId]
    );
    await client.query(
      `DELETE FROM offering_departments
       WHERE offering_id IN (SELECT id FROM course_offerings WHERE is_active = TRUE)`
    );
    await client.query(
      `INSERT INTO offering_departments (offering_id, department_id)
       SELECT id, $1 FROM course_offerings WHERE is_active = TRUE
       ON CONFLICT DO NOTHING`,
      [itDepartmentId]
    );
    const studentUpdate = await client.query(
      `UPDATE students SET department_id = $1`,
      [itDepartmentId]
    );

    await client.query('COMMIT');
    return {
      coursesRenamed: courseUpdate.rowCount,
      offeringsAssignedToIT: offeringUpdate.rowCount,
      studentsAssignedToIT: studentUpdate.rowCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  makeDemoCatalogITOnly()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(`[DEMO IT CATALOG ERROR] ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { makeDemoCatalogITOnly };
