<?php

declare(strict_types=1);

define('HRMS_METHOD', 'POST');
require_once __DIR__ . '/../../includes/bootstrap.php';

$action = 'record-payment';
require __DIR__ . '/../../includes/modules/payroll.php';
