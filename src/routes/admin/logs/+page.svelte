<script>
    export let data;
</script>

<div style="font-family: 'Inter', Arial, sans-serif;">
    <h1>Application Logs</h1>
    {#if data.error}
        <div class="logs-error">{data.error}</div>
    {:else}
        <table class="logs-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Timestamp</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
                {#each data.logs as log}
                    <tr>
                        <td>{log.id}</td>
                        <td class={"log-type-" + log.type}>{log.type}</td>
                        <td>{log.timestamp}</td>
                        <td style="white-space: pre-wrap">{log.text}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>
