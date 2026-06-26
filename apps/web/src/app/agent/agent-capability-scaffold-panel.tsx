import { type WebAgentCapabilityScaffoldViewModel } from "./web-agent-chat-view-model";
import styles from "./page.module.css";

interface AgentCapabilityScaffoldPanelProps {
  scaffold: WebAgentCapabilityScaffoldViewModel;
}

export function AgentCapabilityScaffoldPanel({
  scaffold,
}: AgentCapabilityScaffoldPanelProps) {
  return (
    <article className={styles.planPreviewCard} aria-labelledby="capability-scaffold">
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle} id="capability-scaffold">
            Web Agent capability scaffold
          </h3>
          <p className={styles.planSummary}>
            dev-only / preview. This panel only renders capability, permission,
            model, subagent, hook, MCP, and skill metadata.
          </p>
        </div>
        <span className={styles.webAgentPreviewPill}>preview only</span>
      </div>

      <div className={styles.previewFactsGrid}>
        <PreviewFact label="capabilities" value={String(scaffold.summary.capabilityCount)} />
        <PreviewFact label="previewOnly" value={String(scaffold.summary.previewOnlyCount)} />
        <PreviewFact label="disabled" value={String(scaffold.summary.disabledCount)} />
        <PreviewFact label="forbidden" value={String(scaffold.summary.forbiddenCount)} />
        <PreviewFact label="readOnly" value={String(scaffold.summary.readOnlyCount)} />
        <PreviewFact label="requiresApproval" value={String(scaffold.summary.requiresApprovalCount)} />
        <PreviewFact label="modelProfiles" value={String(scaffold.summary.modelProfileCount)} />
        <PreviewFact label="subagents" value={String(scaffold.summary.subagentCount)} />
      </div>

      <section className={styles.planBlock} aria-labelledby="permission-legend">
        <h4 className={styles.detailTitle} id="permission-legend">
          Permission legend
        </h4>
        <ChipList items={scaffold.permissionLegend} emptyLabel="no permission states" />
      </section>

      <section className={styles.planBlock} aria-labelledby="capability-matrix">
        <h4 className={styles.detailTitle} id="capability-matrix">
          Capability matrix
        </h4>
        <ol className={styles.stepList}>
          {scaffold.capabilityRegistry.map((capability) => (
            <li className={styles.stepItem} key={capability.capabilityId}>
              <div className={styles.stepTopLine}>
                <div>
                  <p className={styles.stepTitle}>{capability.title}</p>
                  <p className={styles.stepKind}>{capability.capabilityId}</p>
                </div>
                <span className={styles.webAgentPreviewPill}>
                  {capability.defaultPermission}
                </span>
              </div>
              <p className={styles.stepDescription}>{capability.description}</p>
              <div className={styles.stepFacts}>
                <span>risk: {capability.riskLevel}</span>
                <span>previewOnly: yes</span>
                <span>devOnly: yes</span>
                <span>liveExecution: {capability.liveExecutionEnabled ? "yes" : "no"}</span>
              </div>
              <ul className={styles.safetyNotes}>
                {capability.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.planBlock} aria-labelledby="permission-policy">
        <h4 className={styles.detailTitle} id="permission-policy">
          Permission policy
        </h4>
        <ol className={styles.stepList}>
          {scaffold.permissionPolicy.map((rule) => (
            <li className={styles.stepItem} key={rule.capabilityId}>
              <div className={styles.stepTopLine}>
                <div>
                  <p className={styles.stepTitle}>{rule.capabilityId}</p>
                  <p className={styles.stepKind}>{rule.permission}</p>
                </div>
                <span className={styles.webAgentPreviewPill}>
                  live: {rule.liveExecutionAllowed ? "yes" : "no"}
                </span>
              </div>
              <p className={styles.stepDescription}>{rule.reason}</p>
              <div className={styles.stepFacts}>
                <span>previewVisible: yes</span>
                <span>devOnly: yes</span>
              </div>
              <ul className={styles.safetyNotes}>
                {rule.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.planBlock} aria-labelledby="model-profiles">
        <h4 className={styles.detailTitle} id="model-profiles">
          Model profiles
        </h4>
        <ol className={styles.stepList}>
          {scaffold.modelProfiles.map((profile) => (
            <li className={styles.stepItem} key={profile.profileId}>
              <div className={styles.stepTopLine}>
                <div>
                  <p className={styles.stepTitle}>{profile.label}</p>
                  <p className={styles.stepKind}>{profile.profileId}</p>
                </div>
                <span className={styles.webAgentPreviewPill}>
                  {profile.modelFamily}
                </span>
              </div>
              <p className={styles.stepDescription}>{profile.description}</p>
              <div className={styles.stepFacts}>
                <span>routing: {profile.routingTarget}</span>
                <span>cost: {profile.costBias}</span>
                <span>latency: {profile.latencyBias}</span>
                <span>reasoning: {profile.reasoningDepth}</span>
              </div>
              <ul className={styles.safetyNotes}>
                {profile.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.planBlock} aria-labelledby="subagents">
        <h4 className={styles.detailTitle} id="subagents">
          Subagent list
        </h4>
        <ol className={styles.stepList}>
          {scaffold.subagents.map((subagent) => (
            <li className={styles.stepItem} key={subagent.role}>
              <div className={styles.stepTopLine}>
                <div>
                  <p className={styles.stepTitle}>{subagent.role}</p>
                  <p className={styles.stepKind}>{subagent.modelProfileId}</p>
                </div>
                <span className={styles.webAgentPreviewPill}>
                  risk: {subagent.riskLevel}
                </span>
              </div>
              <div className={styles.stepFacts}>
                <span>allowedTools: {subagent.allowedTools.length}</span>
                <span>previewOnly: yes</span>
                <span>devOnly: yes</span>
              </div>
              <ChipList items={subagent.allowedTools} emptyLabel="no tools" />
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.planBlock} aria-labelledby="hook-preview">
        <h4 className={styles.detailTitle} id="hook-preview">
          Hook preview
        </h4>
        <ol className={styles.stepList}>
          {scaffold.hookRegistry.map((hook) => (
            <li className={styles.stepItem} key={hook.hookId}>
              <div className={styles.stepTopLine}>
                <div>
                  <p className={styles.stepTitle}>{hook.title}</p>
                  <p className={styles.stepKind}>
                    {hook.hookId} | {hook.lifecycle}
                  </p>
                </div>
                <span className={styles.webAgentPreviewPill}>preview only</span>
              </div>
              <p className={styles.stepDescription}>{hook.description}</p>
              <div className={styles.stepFacts}>
                <span>trigger: {hook.trigger}</span>
                <span>live: no</span>
              </div>
              <ChipList items={hook.suggestedChecks} emptyLabel="no checks" />
              <ul className={styles.safetyNotes}>
                {hook.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.planBlock} aria-labelledby="mcp-preview">
        <h4 className={styles.detailTitle} id="mcp-preview">
          MCP preview
        </h4>
        <ol className={styles.stepList}>
          {scaffold.mcpRegistry.map((connection) => (
            <li className={styles.stepItem} key={connection.connectionId}>
              <div className={styles.stepTopLine}>
                <div>
                  <p className={styles.stepTitle}>{connection.providerName}</p>
                  <p className={styles.stepKind}>
                    {connection.connectionId} | {connection.transport}
                  </p>
                </div>
                <span className={styles.webAgentPreviewPill}>disabled</span>
              </div>
              <p className={styles.stepDescription}>{connection.description}</p>
              <div className={styles.stepFacts}>
                <span>liveConnection: no</span>
                <span>previewOnly: yes</span>
                <span>permission: {connection.permission}</span>
                <span>toolCount: {connection.toolIds.length}</span>
              </div>
              <ChipList items={connection.toolIds} emptyLabel="metadata only" />
              <ChipList
                items={connection.connectionSchema.fields.map(
                  (field) => `${field.name}:${field.type}${field.required ? "*" : ""}`,
                )}
                emptyLabel="no schema"
              />
              <ul className={styles.safetyNotes}>
                {connection.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.planBlock} aria-labelledby="skill-preview">
        <h4 className={styles.detailTitle} id="skill-preview">
          Skill preview
        </h4>
        <ol className={styles.stepList}>
          {scaffold.skillCompatRegistry.map((skill) => (
            <li className={styles.stepItem} key={skill.skillId}>
              <div className={styles.stepTopLine}>
                <div>
                  <p className={styles.stepTitle}>{skill.title}</p>
                  <p className={styles.stepKind}>
                    {skill.skillId} | {skill.manifestFormat}
                  </p>
                </div>
                <span className={styles.webAgentPreviewPill}>preview only</span>
              </div>
              <p className={styles.stepDescription}>{skill.description}</p>
              <div className={styles.stepFacts}>
                <span>modelProfile: {skill.modelProfileId}</span>
                <span>installMode: {skill.installMode}</span>
                <span>executionMode: {skill.executionMode}</span>
              </div>
              <ChipList items={skill.allowedTools} emptyLabel="no tools" />
              <ChipList
                items={skill.requiredPermissions}
                emptyLabel="no permissions"
              />
              <ChipList
                items={skill.metadataSchema.map((field) => `${field.name}:${field.type}${field.required ? "*" : ""}`)}
                emptyLabel="no metadata schema"
              />
              <ul className={styles.safetyNotes}>
                {skill.safetyNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewFact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

function ChipList({
  items,
  emptyLabel,
}: {
  items: readonly string[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className={styles.emptyList}>{emptyLabel}</p>;
  }

  return (
    <div className={styles.webAgentToolSchema}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}
