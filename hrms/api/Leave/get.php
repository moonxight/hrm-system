<?php

define('HRMS_METHOD', 'GET');
require_once __DIR__ . '/../../includes/bootstrap.php';

requireRole(['Admin', 'HR', 'Manager', 'Employee']);

$role = $_SESSION['role_name'];
$params = [];
$scope = scope('lr.employee_id', $params);
if ($role === 'Manager' && ($_GET['team_only'] ?? '') !== '1') {
    $scope = "({$scope} OR lr.employee_id=?)";
    $params[] = ownEmployee();
}
$conditions = [$scope];

if ($role !== 'Employee' && trim($_GET['employee_id'] ?? '') !== '') {
    $conditions[] = 'lr.employee_id=?';
    $params[] = id(trim($_GET['employee_id']), 'employee_id');
}

if (trim($_GET['status'] ?? '') !== '') {
    $conditions[] = 'lr.status=?';
    $params[] = choice(trim($_GET['status']), ['Pending', 'Approved', 'Rejected', 'Cancelled']);
}

if (isset($_GET['year']) && $_GET['year'] !== '') {
    $year = (int) $_GET['year'];
    if (!preg_match('/^\d{4}$/D', $_GET['year']) || $year < 1900 || $year > 9998) {
        fail(400, 'Choose a valid leave year.');
    }
    $conditions[] = 'lr.start_date >= ? AND lr.start_date < ?';
    $params[] = "$year-01-01";
    $params[] = ($year + 1) . '-01-01';
}

if (isset($_GET['leave_request_id'])) {
    $conditions[] = 'lr.leave_request_id=?';
    $params[] = id($_GET['leave_request_id'], 'leave_request_id');
}

$search = $role === 'Employee' ? '' : textValue($_GET['search'] ?? '', 'Search', 400, false);
$roleJoins = '';
if ($search !== '') {
    $mode = choice($_GET['search_by'] ?? 'name', ['name', 'employee_id', 'role'], 'search field');
    $pattern = '%' . strtr($search, ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
    switch ($mode) {
        case 'employee_id':
            $conditions[] = "(CAST(e.employee_id AS TEXT)=? OR e.employee_number ILIKE ? ESCAPE '!')";
            array_push($params, $search, $pattern);
            break;
        case 'role':
            $roleJoins = ' LEFT JOIN users u ON u.employee_id=e.employee_id'
                . ' LEFT JOIN roles r ON r.role_id=u.role_id LEFT JOIN positions p ON p.position_id=e.position_id';
            $conditions[] = "(r.role_name ILIKE ? ESCAPE '!' OR p.position_name ILIKE ? ESCAPE '!')";
            array_push($params, $pattern, $pattern);
            break;
        default:
            $conditions[] = "CONCAT(e.first_name, ' ', e.last_name) ILIKE ? ESCAPE '!'";
            $params[] = $pattern;
            break;
    }
}

$requests = rows(
    "SELECT lr.leave_request_id, lr.employee_id, lr.leave_type_id, lr.start_date, lr.end_date, lr.number_of_days,"
    . " lr.reason, lr.status, lr.approved_by, lr.approved_at, lr.rejection_reason, lr.created_at, lr.updated_at,"
    . " e.employee_number, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, lt.leave_name"
    . ' FROM leave_requests lr JOIN employees e ON lr.employee_id=e.employee_id'
    . ' JOIN leave_types lt ON lr.leave_type_id=lt.leave_type_id'
    . $roleJoins . ' WHERE ' . implode(' AND ', $conditions)
    . ' ORDER BY lr.created_at DESC, lr.leave_request_id DESC',
    $params
);
if ($role === 'Manager') {
    $managerId = ownEmployee();
    foreach ($requests as &$request) {
        if ((int) $request['employee_id'] !== $managerId) {
            unset($request['reason'], $request['rejection_reason']);
        }
    }
    unset($request);
}
reply($requests, 'Leave requests retrieved.', 200, ['count' => count($requests)]);
