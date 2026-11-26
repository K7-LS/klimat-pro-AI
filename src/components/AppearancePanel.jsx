import { Children, cloneElement, isValidElement } from "react";
import { resolvePanelAppearance, workspaceEffect } from "../lib/appearance.js";

export default function AppearancePanel({ panelId, appearance, children, className = "" }) {
  const child = Children.only(children);
  if (!isValidElement(child)) return child;
  const { skinId, effectId, inherited } = resolvePanelAppearance(appearance, panelId);
  return cloneElement(child, {
    "data-appearance-panel": panelId,
    className: [
      child.props.className,
      "kp-appearance-surface",
      inherited ? "kp-appearance-inherited" : "kp-appearance-overridden",
      `kp-skin-${skinId}`,
      `kp-effect-${workspaceEffect(effectId)}`,
      className,
    ].filter(Boolean).join(" "),
  });
}
