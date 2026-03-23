import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();
router.use('*', authMiddleware);

// ── POST /bugs — Create bug report + optional GitHub Issue ──

router.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json();

  const { title, description, steps_to_reproduce, severity, category, screen_name, device_info } = body;

  if (!title || !description) {
    return c.json({ error: 'Title and description are required' }, 400);
  }

  // Try to create a GitHub Issue if token is configured
  let githubIssueUrl: string | null = null;
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO; // format: "owner/repo"

  if (githubToken && githubRepo) {
    try {
      const severityEmoji: Record<string, string> = {
        low: '🟢', medium: '🟡', high: '🟠', critical: '🔴',
      };
      const categoryEmoji: Record<string, string> = {
        ui: '🎨', crash: '💥', performance: '⚡', feature: '💡', data: '🗄️', other: '📋',
      };

      const di = device_info ?? {};
      const issueBody = [
        `## ${severityEmoji[severity] ?? '🟡'} Bug Report`,
        '',
        `**Severity:** ${severity ?? 'medium'}`,
        `**Category:** ${categoryEmoji[category] ?? '📋'} ${category ?? 'other'}`,
        `**Screen:** \`${screen_name ?? 'unknown'}\``,
        `**User:** ${auth.email} (\`${auth.userId}\`)`,
        '',
        '---',
        '',
        '### Description',
        description,
        '',
        steps_to_reproduce ? `### Steps to Reproduce\n${steps_to_reproduce}\n` : '',
        '### Device Info',
        `| Field | Value |`,
        `|-------|-------|`,
        `| Platform | ${di.platform ?? 'N/A'} |`,
        `| OS Version | ${di.osVersion ?? 'N/A'} |`,
        `| Device | ${di.brand ?? ''} ${di.modelName ?? 'N/A'} |`,
        `| App Version | ${di.appVersion ?? 'N/A'} |`,
        `| Expo SDK | ${di.expoSdk ?? 'N/A'} |`,
      ].join('\n');

      const labels = [
        'bug',
        `severity:${severity ?? 'medium'}`,
        `category:${category ?? 'other'}`,
      ];

      const res = await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          title: `[Bug] ${title}`,
          body: issueBody,
          labels,
        }),
      });

      if (res.ok) {
        const issue = await res.json() as { html_url: string };
        githubIssueUrl = issue.html_url;
      } else {
        console.error('[GitHub Issue] Failed:', res.status, await res.text());
      }
    } catch (err) {
      console.error('[GitHub Issue] Error:', err);
    }
  }

  return c.json({
    success: true,
    github_issue_url: githubIssueUrl,
  });
});

export { router as bugsRouter };
