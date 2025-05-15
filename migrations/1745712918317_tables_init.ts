import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// Create role enum type
	await db.schema.createType('user_role').asEnum(['admin', 'user']).execute();

	// Create hr_connection status enum type
	await db.schema
		.createType('hr_connection_status')
		.asEnum(['waiting_us', 'waiting_hr', 'rejected', 'offer'])
		.execute();

	// Create interview type enum
	await db.schema.createType('interview_type').asEnum(['screening', 'technical_interview', 'final', 'other']).execute();

	// Create material type enum
	await db.schema.createType('material_type').asEnum(['video', 'article', 'book', 'course', 'other']).execute();

	// Create task status enum
	await db.schema.createType('task_status').asEnum(['backlog', 'todo', 'in_progress', 'in_review', 'done']).execute();

	// Create markdown_content table
	await db.schema
		.createTable('markdown_content')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('content_text', 'text', col => col.notNull())
		.execute();

	// Create video table
	await db.schema
		.createTable('video')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('youtube_link', 'varchar(128)', col => col.notNull())
		.addColumn('s3_object_id', 'varchar(128)', col => col.notNull())
		.addColumn('contentType', 'varchar(64)')
		.execute();

	// Create user table
	await db.schema
		.createTable('user')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('role', sql`user_role`, col => col.notNull())
		.addColumn('name', 'varchar(64)', col => col.notNull())
		.addColumn('email', 'varchar(64)', col => col.notNull().unique())
		.addColumn('telegram_id', 'integer')
		.addColumn('telegram_username', 'varchar(64)', col => col.notNull().unique())
		.execute();

	// Create subject table
	await db.schema
		.createTable('subject')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('name', 'varchar(64)', col => col.notNull())
		.addColumn('color_code', 'varchar(7)', col => col.notNull())
		.execute();

	// Create task table
	await db.schema
		.createTable('task')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('student_user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade'))
		.addColumn('mentor_user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade'))
		.addColumn('summary', 'varchar(128)', col => col.notNull())
		.addColumn('markdown_content_id', 'uuid', col =>
			col.notNull().references('markdown_content.id').onDelete('cascade'),
		)
		.addColumn('deadline', 'timestamp', col => col.notNull())
		.addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.addColumn('priority', 'integer', col => col.notNull())
		.addColumn('status', sql`task_status`, col => col.notNull())
		.execute();

	// Create hr_connection table
	await db.schema
		.createTable('hr_connection')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('student_user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade'))
		.addColumn('name', 'varchar(64)', col => col.notNull())
		.addColumn('status', sql`hr_connection_status`, col => col.notNull())
		.addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.addColumn('chat_link', 'varchar(128)')
		.execute();

	// Create call table
	await db.schema
		.createTable('call')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('student_user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade'))
		.addColumn('recording_link', 'varchar(128)')
		.addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.addColumn('calendar_link', 'varchar(128)')
		.execute();

	// Create journal_record table
	await db.schema
		.createTable('journal_record')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('student_user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade'))
		.addColumn('name', 'varchar(64)', col => col.notNull())
		.addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.addColumn('markdown_content_id', 'uuid', col =>
			col.notNull().references('markdown_content.id').onDelete('cascade'),
		)
		.execute();

	// Create interview table
	await db.schema
		.createTable('interview')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('hr_connection_id', 'uuid', col => col.notNull().references('hr_connection.id').onDelete('cascade'))
		.addColumn('name', 'varchar(64)', col => col.notNull())
		.addColumn('type', sql`interview_type`, col => col.notNull())
		.addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.execute();

	// Create material table
	await db.schema
		.createTable('material')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('student_user_id', 'uuid', col => col.references('user.id').onDelete('set null'))
		.addColumn('subject_id', 'uuid', col => col.notNull().references('subject.id').onDelete('cascade'))
		.addColumn('name', 'varchar(64)', col => col.notNull())
		.addColumn('type', sql`material_type`, col => col.notNull())
		.addColumn('video_id', 'uuid', col => col.references('video.id').onDelete('set null'))
		.addColumn('markdown_content_id', 'uuid', col => col.references('markdown_content.id').onDelete('set null'))
		.addColumn('is_archived', 'boolean', col => col.notNull().defaultTo(false))
		.execute();

	// Create interview_recording table
	await db.schema
		.createTable('interview_recording')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('student_user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade'))
		.addColumn('contact_stage_id', 'uuid', col => col.notNull().references('hr_connection.id').onDelete('cascade'))
		.addColumn('video_id', 'uuid', col => col.references('video.id').onDelete('set null'))
		.addColumn('backup_link', 'varchar(256)')
		.addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
		.addColumn('name', 'varchar(64)', col => col.notNull())
		.execute();

	// Create feedback table
	await db.schema
		.createTable('feedback')
		.addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`uuid_generate_v7()`))
		.addColumn('interview_recording_id', 'uuid', col =>
			col.notNull().references('interview_recording.id').onDelete('cascade'),
		)
		.addColumn('markdown_content_id', 'uuid', col =>
			col.notNull().references('markdown_content.id').onDelete('cascade'),
		)
		.execute();

	// Create indexes
	await db.schema.createIndex('user_email_idx').on('user').column('email').execute();

	await db.schema.createIndex('task_student_user_id_idx').on('task').column('student_user_id').execute();

	await db.schema.createIndex('task_mentor_user_id_idx').on('task').column('mentor_user_id').execute();

	await db.schema
		.createIndex('hr_connection_student_user_id_idx')
		.on('hr_connection')
		.column('student_user_id')
		.execute();

	await db.schema.createIndex('call_student_user_id_idx').on('call').column('student_user_id').execute();

	await db.schema
		.createIndex('journal_record_student_user_id_idx')
		.on('journal_record')
		.column('student_user_id')
		.execute();

	await db.schema.createIndex('interview_hr_connection_id_idx').on('interview').column('hr_connection_id').execute();

	await db.schema.createIndex('material_subject_id_idx').on('material').column('subject_id').execute();

	await db.schema.createIndex('material_student_user_id_idx').on('material').column('student_user_id').execute();

	await db.schema
		.createIndex('interview_recording_student_user_id_idx')
		.on('interview_recording')
		.column('student_user_id')
		.execute();

	await db.schema
		.createIndex('interview_recording_contact_stage_id_idx')
		.on('interview_recording')
		.column('contact_stage_id')
		.execute();

	await db.schema
		.createIndex('feedback_interview_recording_id_idx')
		.on('feedback')
		.column('interview_recording_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('feedback').execute();
	await db.schema.dropTable('interview_recording').execute();
	await db.schema.dropTable('material').execute();
	await db.schema.dropTable('interview').execute();
	await db.schema.dropTable('journal_record').execute();
	await db.schema.dropTable('call').execute();
	await db.schema.dropTable('hr_connection').execute();
	await db.schema.dropTable('task').execute();
	await db.schema.dropTable('subject').execute();
	await db.schema.dropTable('user').execute();
	await db.schema.dropTable('markdown_content').execute();

	// Drop enum types
	await db.schema.dropType('material_type').execute();
	await db.schema.dropType('interview_type').execute();
	await db.schema.dropType('hr_connection_status').execute();
	await db.schema.dropType('user_role').execute();
}
