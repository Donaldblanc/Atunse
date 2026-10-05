import { AttentionPanel } from "../attention-panel";
import { buildAttentionPanelDeps } from "../attention-deps";
import { getAttentionPanel, parseAttentionPanel } from "../attention-panels";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesAttention = (params: OverviewParams) => parseAttentionPanel(params.attention) !== null;

export async function AttentionSlot({ params, selection, actingUser }: OverviewDialogContext) {
  const panel = parseAttentionPanel(params.attention);
  if (!panel) return null;
  const data = await getAttentionPanel(buildAttentionPanelDeps(), actingUser, panel);
  return data && <AttentionPanel data={data} selection={selection} />;
}
