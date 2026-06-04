import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://clickhouse:8123';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const MODEL = process.env.MODEL || 'llama3';
const ANALYSIS_INTERVAL = parseInt(process.env.ANALYSIS_INTERVAL || '60000', 10); // 60 seconds

/**
 * Query ClickHouse for error traces not yet analysed
 */
async function getUnanalysedErrorTraces() {
  try {
    const sql = `
      SELECT
        t.TraceId,
        t.ServiceName,
        t.OperationName,
        t.StartTime,
        t.StatusMessage,
        groupArray(
          tuple(
            t.SpanId,
            t.ServiceName,
            t.OperationName,
            t.Duration / 1000000 as DurationMs,
            if(t.StatusCode = 2, 'ERROR', 'OK') as Status,
            t.StatusMessage
          )
        ) as spans
      FROM traces t
      WHERE t.StatusCode = 2
        AND t.StartTime > now() - INTERVAL 5 MINUTE
        AND t.TraceId NOT IN (SELECT TraceId FROM trace_insights)
      GROUP BY t.TraceId, t.ServiceName, t.OperationName, t.StartTime, t.StatusMessage
      ORDER BY t.StartTime DESC
      LIMIT 10
    `;

    const response = await axios.post(
      `${CLICKHOUSE_URL}?query=${encodeURIComponent(sql)}&format=JSON`,
      null,
      { timeout: 5000 }
    );

    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching unanalysed traces:', error.message);
    return [];
  }
}

/**
 * Format trace data into a prompt for the LLM
 */
function buildPrompt(trace) {
  const spanList = trace.spans
    .map(
      (span, idx) =>
        `${idx + 1}. [${span[2]}] ${span[3]} | Duration: ${span[4]}ms | Status: ${span[5]}${
          span[6] ? ` | Error: ${span[6]}` : ''
        }`
    )
    .join('\n');

  return `You are a distributed systems expert specializing in microservices debugging. 
Analyze this error trace and identify the root cause.

Trace ID: ${trace.TraceId}
Service: ${trace.ServiceName}
Operation: ${trace.OperationName}
Error Message: ${trace.StatusMessage || 'Unknown error'}

Spans in order (oldest to newest):
${spanList}

Analyze the sequence of events and identify:
1. What went wrong (root cause)
2. Which service/span caused the failure
3. How to prevent this in the future

Respond in JSON format only, with no markdown:
{
  "root_cause": "Clear one-sentence description of the root cause",
  "impacted_services": ["service1", "service2"],
  "severity": "low|medium|high|critical",
  "recommendation": "Actionable one-sentence fix"
}`;
}

/**
 * Call Ollama LLM to analyze trace
 */
async function analyzeTraceWithLLM(trace) {
  try {
    const prompt = buildPrompt(trace);

    console.log(`🧠 Analyzing trace ${trace.TraceId} with ${MODEL}...`);

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: MODEL,
        prompt,
        stream: false,
        temperature: 0.3,
      },
      { timeout: 60000 } // Give LLM up to 60 seconds
    );

    if (!response.data.response) {
      throw new Error('No response from Ollama');
    }

    // Parse JSON from response
    const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from LLM response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    console.log(`✓ Analysis complete for ${trace.TraceId}`);

    return {
      rootCause: analysis.root_cause || 'Unknown cause',
      impactedServices: analysis.impacted_services || [],
      severity: analysis.severity || 'medium',
      recommendation: analysis.recommendation || 'Investigate service logs',
    };
  } catch (error) {
    console.error(`✗ Error analyzing trace with LLM: ${error.message}`);
    return null;
  }
}

/**
 * Store analysis in ClickHouse
 */
async function storeAnalysis(trace, analysis) {
  try {
    const sql = `
      INSERT INTO trace_insights (
        TraceId,
        ServiceName,
        OperationName,
        AnalysedAt,
        RootCause,
        ImpactedSpans,
        Recommendation,
        Severity
      ) VALUES (
        '${trace.TraceId}',
        '${trace.ServiceName}',
        '${trace.OperationName}',
        now(),
        '${analysis.rootCause.replace(/'/g, "''")}',
        ['${analysis.impactedServices.join("','")}'],
        '${analysis.recommendation.replace(/'/g, "''")}',
        '${analysis.severity}'
      )
    `;

    await axios.post(
      `${CLICKHOUSE_URL}?query=${encodeURIComponent(sql)}`,
      null,
      { timeout: 5000 }
    );

    console.log(`✓ Stored analysis for trace ${trace.TraceId}`);
  } catch (error) {
    console.error('Error storing analysis:', error.message);
  }
}

/**
 * Main analysis loop
 */
async function analyzeErrorTraces() {
  try {
    const traces = await getUnanalysedErrorTraces();

    if (traces.length === 0) {
      console.log('No unanalysed error traces found');
      return;
    }

    console.log(`Found ${traces.length} unanalysed error traces`);

    for (const trace of traces) {
      const analysis = await analyzeTraceWithLLM(trace);

      if (analysis) {
        await storeAnalysis(trace, analysis);
      }

      // Throttle to avoid overwhelming Ollama
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error('Error in analysis loop:', error.message);
  }
}

/**
 * Start the worker
 */
async function start() {
  console.log('🚀 Starting LLM trace analyser...');
  console.log(`📊 ClickHouse: ${CLICKHOUSE_URL}`);
  console.log(`🧠 Ollama: ${OLLAMA_URL} (model: ${MODEL})`);
  console.log(`⏱️  Analysis interval: ${ANALYSIS_INTERVAL}ms`);

  // Initial run
  await analyzeErrorTraces();

  // Periodic runs
  setInterval(analyzeErrorTraces, ANALYSIS_INTERVAL);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Stopping analyser...');
  process.exit(0);
});

start().catch((error) => {
  console.error('Failed to start analyser:', error.message);
  process.exit(1);
});
