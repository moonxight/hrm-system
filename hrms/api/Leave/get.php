<?php

define('HRMS_METHOD', 'GET');
require_once __DIR__ . '/../../includes/bootstrap.php';


header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Only GET requests are allowed."
    ]);
    exit;
}

$employee_id = isset($_GET["employee_id"]) ? trim($_GET["employee_id"]) : null;
$status = isset($_GET["status"]) ? trim($_GET["status"]) : null;
$user_role = $_SESSION["role_name"] ?? "";

if ($user_role === "Employee") {

    $session_employee_id = $_SESSION["employee_id"] ?? null;

    if (
        $session_employee_id === null ||
        !filter_var($session_employee_id, FILTER_VALIDATE_INT) ||
        (int)$session_employee_id <= 0
    ) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Authenticated employee information is unavailable."
        ]);
        exit;
    }

    $employee_id = (int)$session_employee_id;
} elseif (!in_array($user_role, ["Admin", "HR", "Manager"], true)) {

    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Access denied."
    ]);
    exit;
}

$allowed_statuses = ["Pending", "Approved", "Rejected", "Cancelled"];

if ($employee_id !== null && $employee_id !== "") {
    if (!filter_var($employee_id, FILTER_VALIDATE_INT) || (int)$employee_id <= 0) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Invalid employee_id."
        ]);
        exit;
    }

    $employee_id = (int)$employee_id;
}

if ($status !== null && $status !== "") {
    if (!in_array($status, $allowed_statuses, true)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Invalid status."
        ]);
        exit;
    }
}

$sql = "
    SELECT
        lr.leave_request_id,
        lr.employee_id,
        CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
        lr.leave_type_id,
        lt.leave_name,
        lr.start_date,
        lr.end_date,
        lr.number_of_days,
        lr.reason,
        lr.status,
        lr.approved_by,
        lr.approved_at,
        lr.rejection_reason,
        lr.created_at,
        lr.updated_at
    FROM leave_requests lr
    INNER JOIN employees e
        ON lr.employee_id = e.employee_id
    INNER JOIN leave_types lt
        ON lr.leave_type_id = lt.leave_type_id
";

$conditions = [];
$params = [];
$types = "";

if (isset($_GET['year']) && $_GET['year'] !== '') {
    $year = (int) $_GET['year'];
    if (!preg_match('/^\d{4}$/D', $_GET['year']) || $year < 1900 || $year > 9998) {
        fail(400, 'Choose a valid leave year.');
    }
    $conditions[] = "lr.start_date >= ? AND lr.start_date < ?";
    $params[] = "$year-01-01";
    $params[] = ($year + 1) . '-01-01';
    $types .= "ss";
}
if (isset($_GET['leave_request_id'])) {
    $conditions[] = "lr.leave_request_id = ?";
    $params[] = id($_GET['leave_request_id'], 'leave_request_id');
    $types .= "i";
}
if ($user_role === "Manager") {
    $conditions[] = "(lr.employee_id = ? OR EXISTS (SELECT 1 FROM manager_assignments ma
        WHERE ma.employee_id = lr.employee_id AND ma.manager_employee_id = ? AND ma.status = 'Active'))";
    $manager = ownEmployee();
    $params[] = $manager;
    $params[] = $manager;
    $types .= "ii";
}

if ($employee_id !== null && $employee_id !== "") {
    $conditions[] = "lr.employee_id = ?";
    $params[] = $employee_id;
    $types .= "i";
}

if ($status !== null && $status !== "") {
    $conditions[] = "lr.status = ?";
    $params[] = $status;
    $types .= "s";
}

if (!empty($conditions)) {
    $sql .= " WHERE " . implode(" AND ", $conditions);
}

$sql .= " ORDER BY lr.created_at DESC";

$stmt = $conn->prepare($sql);

if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to retrieve leave requests."
    ]);
    exit;
}

if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}

if (!$stmt->execute()) {
    $stmt->close();

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to retrieve leave requests."
    ]);
    exit;
}

$result = $stmt->get_result();

$requests = [];

while ($row = $result->fetch_assoc()) {
    $requests[] = $row;
}

$stmt->close();

echo json_encode([
    "success" => true,
    "count" => count($requests),
    "data" => $requests
]);

?>
