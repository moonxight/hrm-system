<?php

declare(strict_types=1);

use GuzzleHttp\Client as HttpClient;
use GuzzleHttp\Psr7\HttpFactory;
use SenderKit\Client;
use SenderKit\Exception\ApiException;
use SenderKit\Exception\NetworkException;
use SenderKit\Request\EmailContent;
use SenderKit\Request\RawSend;

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

$apiKey = trim((string) getenv('SENDERKIT_API_KEY'));
$from = trim((string) getenv('SENDERKIT_FROM_EMAIL'));
$appUrl = rtrim((string) (getenv('HRMS_PUBLIC_URL') ?: getenv('RENDER_EXTERNAL_URL')), '/');
if (getenv('HRMS_EMAIL_NOTIFICATIONS') !== '1' || $apiKey === '') {
    exit;
}
if (!str_starts_with($appUrl, 'https://') || !filter_var($appUrl, FILTER_VALIDATE_URL)
    || (!str_starts_with($apiKey, 'sk_test_')
        && !(str_starts_with($apiKey, 'sk_live_') && filter_var($from, FILTER_VALIDATE_EMAIL)))) {
    fwrite(STDERR, "HRMS email configuration requires a SenderKit key, an HTTPS app URL, and a sender address in live mode.\n");
    exit(1);
}

require_once dirname(__DIR__) . '/vendor/autoload.php';
$backendRoot = getenv('HRMS_BACKEND_ROOT') ?: dirname(__DIR__) . '/hrms';
require_once $backendRoot . '/config/database.php';

$factory = new HttpFactory();
$sender = new Client(
    apiKey: $apiKey,
    maxRetries: 0,
    httpClient: new HttpClient(['timeout' => 8, 'connect_timeout' => 3]),
    requestFactory: $factory,
    streamFactory: $factory,
);
$pdo->exec("UPDATE notification_emails SET status='failed', last_error='retry_limit'
    WHERE status='pending' AND attempts >= 5 AND available_at <= NOW()");
$claim = $pdo->prepare("WITH next AS (
        SELECT notification_id FROM notification_emails
        WHERE status='pending' AND attempts < 5 AND available_at <= NOW()
        ORDER BY available_at, notification_id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE notification_emails AS q
    SET attempts=q.attempts+1, available_at=NOW()+INTERVAL '2 minutes'
    FROM next, notifications n, users u
    WHERE q.notification_id=next.notification_id AND n.notification_id=q.notification_id AND u.user_id=n.user_id
    RETURNING q.notification_id, q.attempts, u.email, u.account_status");
$finish = $pdo->prepare("UPDATE notification_emails
    SET status=?, provider_message_id=?, last_error=?, available_at=NOW()+CAST(? AS INTEGER)*INTERVAL '1 minute'
    WHERE notification_id=? AND attempts=? AND status='pending'");
$text = "There is a new notification in your HRMS account. Sign in to view it: " . $appUrl;
$link = htmlspecialchars($appUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$html = '<p>There is a new notification in your HRMS account.</p><p><a href="' . $link . '">Sign in to view it</a></p>';

for ($processed = 0; $processed < 10; $processed++) {
    $claim->execute();
    $notification = $claim->fetch();
    $claim->closeCursor();
    if (!$notification) {
        break;
    }

    $id = (int) $notification['notification_id'];
    $attempt = (int) $notification['attempts'];
    $messageId = null;
    $error = null;
    $delay = 0;
    $status = 'skipped';
    if ($notification['account_status'] === 'Active' && filter_var($notification['email'], FILTER_VALIDATE_EMAIL)) {
        try {
            $result = $sender->sendRaw(new RawSend(
                to: $notification['email'],
                content: new EmailContent(subject: 'New HRMS notification', html: $html, text: $text),
                from: $from !== '' ? $from : null,
                idempotencyKey: 'hrms-' . hash('sha256', $appUrl . '/' . $id),
            ));
            $messageId = $result->id;
            $status = 'accepted';
        } catch (ApiException | NetworkException $exception) {
            $code = $exception instanceof ApiException ? $exception->status : 0;
            $error = $code ? 'http_' . $code : 'network';
            $retry = $code === 0 || $code === 429 || $code >= 500;
            $status = $retry && $attempt < 5 ? 'pending' : 'failed';
            $delay = 2 ** $attempt;
            error_log("HRMS notification email {$id}: {$error}");
        }
    }
    $finish->execute([$status, $messageId, $error, $delay, $id, $attempt]);
}
