CREATE SEQUENCE employee_number_seq START WITH 1001;

SELECT setval(
    'employee_number_seq',
    GREATEST(1000, COALESCE(MAX(SUBSTRING(employee_number FROM '^NEX-([0-9]{1,12})$')::BIGINT), 0))
) FROM employees;

ALTER SEQUENCE employee_number_seq OWNED BY employees.employee_number;
ALTER TABLE employees ALTER COLUMN employee_number
    SET DEFAULT ('NEX-' || nextval('employee_number_seq')::TEXT);
