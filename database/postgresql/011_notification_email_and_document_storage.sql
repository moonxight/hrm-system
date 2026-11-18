CREATE TABLE onboarding_document_files (
    document_id BIGINT PRIMARY KEY REFERENCES onboarding_documents(document_id) ON DELETE CASCADE,
    content BYTEA NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 5242880)
);

CREATE TABLE notification_emails (
    notification_id BIGINT PRIMARY KEY REFERENCES notifications(notification_id) ON DELETE CASCADE,
    attempts SMALLINT NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'failed', 'skipped')),
    provider_message_id TEXT,
    last_error TEXT
);

CREATE INDEX idx_notification_emails_pending ON notification_emails(available_at, notification_id)
    WHERE status = 'pending';

CREATE FUNCTION queue_notification_email() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('hrms.email_notifications', true) = 'on'
        AND NEW.entity IN ('leave_requests', 'onboarding_documents', 'onboarding_forms',
            'payroll', 'performance_reviews', 'interviews', 'training_enrollments') THEN
        INSERT INTO notification_emails(notification_id) VALUES (NEW.notification_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER queue_notification_email_after_insert
    AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION queue_notification_email();
