CREATE TABLE payroll_payments (
    payroll_id BIGINT PRIMARY KEY REFERENCES payroll(payroll_id),
    paid_on DATE NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Bank transfer', 'Mobile money', 'Cash', 'Cheque')),
    payment_reference VARCHAR(100) NOT NULL CHECK (length(btrim(payment_reference)) > 0),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL,
    recorded_by BIGINT NOT NULL REFERENCES users(user_id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
