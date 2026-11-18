<?php

declare(strict_types=1);

define('HRMS_METHOD', 'GET');
require_once __DIR__ . '/../../includes/bootstrap.php';

$action = 'get-items';
require __DIR__ . '/../../includes/modules/payroll.php';
