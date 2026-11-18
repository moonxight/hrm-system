<?php

define('HRMS_METHOD', 'GET');
require_once __DIR__ . '/../../includes/bootstrap.php';

requireRole(['Admin', 'HR', 'Manager', 'Employee']);
$from = dateValue($_GET['from'] ?? null, 'from');
$to = dateValue($_GET['to'] ?? null, 'to');
if ($from > $to || (new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->days > 62) {
    fail(400, 'Choose a calendar range of up to 63 days.');
}

$role = $_SESSION['role_name'];
$params = [$from, $to];
$people = scope('e.employee_id', $params);
if ($role === 'Manager') {
    $people = "($people OR e.employee_id=?)";
    $params[] = ownEmployee();
}

$starts = rows("SELECT 'onboarding' AS kind,o.onboarding_id AS record_id,
    CONCAT_WS(' ',e.first_name,e.last_name) AS title,o.start_date,o.start_date AS end_date,
    o.onboarding_status AS status
    FROM onboarding o JOIN employees e ON e.employee_id=o.employee_id
    WHERE o.start_date BETWEEN ? AND ? AND $people ORDER BY o.start_date,o.onboarding_id", $params);

if ($role === 'Employee' && onboardingRequired(ownEmployee())) reply($starts);

$leave = rows("SELECT 'leave' AS kind,lr.leave_request_id AS record_id,
    CONCAT_WS(' ',e.first_name,e.last_name) AS title,lr.start_date,lr.end_date,lr.status
    FROM leave_requests lr JOIN employees e ON e.employee_id=lr.employee_id
    WHERE lr.end_date>=? AND lr.start_date<=? AND $people AND lr.status IN ('Pending','Approved')
    ORDER BY lr.start_date,lr.leave_request_id", $params);

$interviews = [];
if ($role !== 'Employee') {
    $params = [$from, $to];
    $where = '1=1';
    if ($role === 'Manager') {
        $where = '(v.manager_employee_id=? OR i.interviewer_employee_id=?)';
        array_push($params, ownEmployee(), ownEmployee());
    }
    $interviews = rows("SELECT 'interview' AS kind,i.interview_id AS record_id,i.application_id,
        p.full_name AS title,i.status,s.day AS start_date,s.day AS end_date,s.clock AS time
        FROM interviews i JOIN job_applications a ON a.application_id=i.application_id
        JOIN job_vacancies v ON v.vacancy_id=a.vacancy_id JOIN applicants p ON p.applicant_id=a.applicant_id
        CROSS JOIN LATERAL (SELECT (i.scheduled_at AT TIME ZONE 'Africa/Lusaka')::date AS day,
            to_char(i.scheduled_at AT TIME ZONE 'Africa/Lusaka','HH24:MI') AS clock) s
        WHERE s.day BETWEEN ? AND ? AND $where AND i.status<>'Cancelled'
        ORDER BY i.scheduled_at,i.interview_id", $params);
}

reply(array_merge($starts, $leave, $interviews));
