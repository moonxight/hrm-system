<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('This command can only be run from the command line.');
}

$projectRoot = dirname(__DIR__);
$backendRoot = (string) (getenv('HRMS_BACKEND_ROOT') ?: $projectRoot . '/hrms');
require_once $backendRoot . '/config/database.php';

$driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
$dialect = $driver === 'pgsql' ? 'postgresql' : $driver;
$migrationDirectory = $projectRoot . '/database/' . $dialect;
if ($driver === 'pgsql') {
    // A deploy and an operator can run migrations against the same database.
    $pdo->query('SELECT pg_advisory_lock(1558124704)')->closeCursor();
}

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )'
);

$files = is_dir($migrationDirectory) ? (glob($migrationDirectory . '/*.sql') ?: []) : [];
if ($driver === 'mysql' && $files === []) {
    $legacyMigration = $backendRoot . '/migrations/001_initial_schema.sql';
    if (is_file($legacyMigration)) {
        $files = [$legacyMigration];
    }
}

if ($files === []) {
    fwrite(STDERR, "No migrations are available for database driver '{$driver}'.\n");
    exit(1);
}
sort($files, SORT_STRING);
$applied = $pdo->query('SELECT version FROM schema_migrations');
$appliedVersions = array_fill_keys($applied->fetchAll(PDO::FETCH_COLUMN), true);
$applied->closeCursor();

try {
    foreach ($files as $file) {
        $version = basename($file);
        if (isset($appliedVersions[$version])) {
            echo "Already applied: {$version}\n";
            continue;
        }

        $sql = file_get_contents($file);
        if ($sql === false) {
            throw new RuntimeException("Could not read migration: {$version}");
        }

        try {
            if ($driver === 'pgsql') {
                // The migration and its history record commit as one statement.
                $marker = '$hrms_migration_' . bin2hex(random_bytes(8)) . '$';
                $body = '$hrms_apply_' . bin2hex(random_bytes(8)) . '$';
                $versionSql = $pdo->quote($version);
                $pdo->exec("DO {$body} BEGIN
                    EXECUTE {$marker}\n{$sql}\n{$marker};
                    INSERT INTO schema_migrations(version) VALUES ({$versionSql});
                END {$body}");
            } else {
                $pdo->exec($sql);
                $record = $pdo->prepare('INSERT INTO schema_migrations (version) VALUES (?)');
                $record->execute([$version]);
            }
        } catch (Throwable $exception) {
            throw new RuntimeException("{$version}: " . $exception->getMessage(), 0, $exception);
        }

        echo "Applied: {$version}\n";
    }
} catch (Throwable $exception) {
    fwrite(STDERR, 'Migration failed: ' . $exception->getMessage() . "\n");
    exit(1);
}

if ($driver === 'pgsql') {
    $pdo->query('SELECT pg_advisory_unlock(1558124704)')->closeCursor();
}
echo "Database migrations are up to date.\n";

