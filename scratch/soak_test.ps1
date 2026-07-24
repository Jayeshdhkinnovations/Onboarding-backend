$durationMinutes = 240
$intervalMinutes = 20
$endTime = (Get-Date).AddMinutes($durationMinutes)
$runIndex = 1
$results = @()

Write-Output "Starting 4-Hour Soak & Stability Test Suite"
Write-Output "Duration: $durationMinutes minutes, Interval: $intervalMinutes minutes"
Write-Output "Expected End Time: $endTime"
Write-Output "========================================="

while ((Get-Date) -lt $endTime) {
    $startTime = Get-Date
    Write-Output "[$startTime] Starting Run #$runIndex..."

    # Capture system memory usage before test
    $os = Get-CimInstance Win32_OperatingSystem
    $memBefore = [math]::Round($os.FreePhysicalMemory / 1024)

    # Run Jest tests
    $output = npm run test 2>&1
    $exitCode = $LASTEXITCODE

    $endTimeRun = Get-Date
    $elapsed = [math]::Round(($endTimeRun - $startTime).TotalSeconds, 2)
    
    $osAfter = Get-CimInstance Win32_OperatingSystem
    $memAfter = [math]::Round($osAfter.FreePhysicalMemory / 1024)

    # Determine status
    $status = "Passed"
    if ($exitCode -ne 0) {
        $status = "Failed"
    }

    # Extract number of passed tests from output
    $testsPassed = 0
    $outputStr = [string]::Join("`n", $output)
    $match = [regex]::Match($outputStr, "Tests:\s+(\d+)\s+passed")
    if ($match.Success) {
        $testsPassed = [int]$match.Groups[1].Value
    }

    Write-Output "Run #$runIndex Completed: Status=$status, Duration=$elapsed sec, Passed=$testsPassed, Free Mem Before=${memBefore}MB, After=${memAfter}MB"
    Write-Output "-----------------------------------------"

    $runResult = @{
        RunIndex = $runIndex
        Timestamp = $startTime.ToString("yyyy-MM-dd HH:mm:ss")
        Status = $status
        Duration = $elapsed
        TestsPassed = $testsPassed
        FreeMemoryBeforeMB = $memBefore
        FreeMemoryAfterMB = $memAfter
    }
    $results += $runResult

    # Export intermediate results
    $results | ConvertTo-Json | Out-File -FilePath "scratch/soak_test_results.json" -Encoding utf8

    $runIndex++

    # Sleep for interval
    if ((Get-Date).AddMinutes($intervalMinutes) -lt $endTime) {
        Start-Sleep -Seconds ($intervalMinutes * 60)
    } else {
        $remainingSeconds = ($endTime - (Get-Date)).TotalSeconds
        if ($remainingSeconds -gt 0) {
            Start-Sleep -Seconds $remainingSeconds
        }
    }
}

Write-Output "========================================="
Write-Output "Soak & Stability Test Completed successfully."
