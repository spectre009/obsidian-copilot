import { SettingItem } from "@/components/ui/setting-item";
import React from "react";

export interface BlockVendorServicesSettingProps {
  blocked: boolean;
  onBlockedChange: (blocked: boolean) => void;
}

export function BlockVendorServicesSetting({
  blocked,
  onBlockedChange,
}: BlockVendorServicesSettingProps): React.ReactElement {
  return (
    <div className="tw-flex tw-flex-col tw-gap-2">
      <SettingItem
        type="switch"
        title="Block vendor services"
        description="Stops every connection to Brevilabs and OpenArtifacts, and the upstream release checks."
        checked={blocked}
        onCheckedChange={onBlockedChange}
      />
      {blocked && (
        <p className="tw-m-0 tw-text-sm tw-text-muted">
          Copilot Plus models, license checks, web and video relays, publishing, and report uploads
          are off. Your stored license and model settings are kept for when you turn this off.
        </p>
      )}
    </div>
  );
}
