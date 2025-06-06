import { useMemo, useState } from "preact/hooks";

import { Dropdown } from "bootstrap";

import { getApiEndpoint } from "@worm/shared/src/api";
import { storageSetByKeys } from "@worm/shared/src/storage";
import { ApiShareRequest, ApiShareResponse } from "@worm/types/src/api";
import { SchemaExport } from "@worm/types/src/storage";

import { useLanguage } from "../../lib/language";
import { SelectedRule } from "../../lib/types";
import { useConfig } from "../../store/Config";

import { useToast } from "../alert/useToast";
import DropdownButton from "../menu/DropdownButton";
import DropdownMenuContainer from "../menu/DropdownMenuContainer";
import MenuItem from "../menu/MenuItem";
import Spinner from "../progress/Spinner";

type ExportButtonProps = {
  selectedRules?: SelectedRule[];
  stopExporting: () => void;
};

export default function ExportButton({
  selectedRules,
  stopExporting,
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    matchers,
    storage: {
      sync: { exportLinks },
    },
  } = useConfig();
  const language = useLanguage();
  const selectedCount = useMemo(
    () => selectedRules?.filter((s) => s.isSelected).length ?? 0,
    [selectedRules]
  );
  const { showToast } = useToast();

  const closeDropdown = () => {
    const target = document.getElementById("export-modal-dropdown-button");
    if (!target) return;

    const element = new Dropdown(target);
    element.hide();
  };

  const handleExportFile = () => {
    if (!selectedRules) return;

    closeDropdown();
    const selectedMatchers = matchers?.filter(
      (matcher) =>
        selectedRules.find(
          (selection) => selection.identifier === matcher.identifier
        )?.isSelected
    );
    const schemaExport: SchemaExport = {
      version: 1,
      data: {
        matchers: selectedMatchers,
      },
    };
    const href = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(schemaExport, null, 2)
    )}`;
    const anchor = document.createElement("a");
    const filename = `WordReplacerMax_Rules_${new Date().getTime()}.json`;

    anchor.setAttribute("href", href);
    anchor.setAttribute("download", filename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    stopExporting();

    const toastMessage = `Your ${
      (selectedMatchers?.length ?? 0) > 1 ? "rules were" : "rule was"
    } exported successfully as ${filename}`;
    showToast({
      message: toastMessage,
      options: { severity: "success" },
    });
  };

  const handleExportLink = async () => {
    if (!selectedRules) return;

    const requestBody: ApiShareRequest = {
      matchers: selectedRules.filter((selectedRule) => selectedRule.isSelected),
    };

    closeDropdown();
    setIsLoading(true);
    const result = await fetch(getApiEndpoint("POST:share"), {
      method: "POST",
      body: JSON.stringify(requestBody),
    })
      .catch()
      .finally(() => {
        setIsLoading(false);
      });
    const json: ApiShareResponse = await result.json();

    if (!result.ok) {
      return showToast({
        message: JSON.stringify(json),
        options: { severity: "danger" },
      });
    }

    /**
     * NOTE: Backwards compatibility handler between API changes. This may be
     * removed later.
     */
    // @ts-ignore
    let responseUrl = json.data?.value?.url;

    if (!responseUrl) {
      responseUrl = json.data?.url;
    }

    if (!responseUrl) {
      stopExporting();

      return showToast({
        message: language.options.GENERATE_SHARE_LINK_FAILED,
        options: { severity: "danger", showContactSupport: true },
      });
    }

    const newExportLinks = [
      ...(exportLinks || []),
      {
        identifier: new Date().getTime(),
        url: responseUrl,
      },
    ];

    storageSetByKeys(
      {
        exportLinks: newExportLinks,
      },
      {
        onError: (message) => {
          showToast({
            message,
            options: { severity: "danger" },
          });
        },
        onSuccess: () => {
          stopExporting();
          showToast({
            message: language.options.LINK_EXPORT_SUCCESS,
            options: { severity: "success" },
          });
        },
      }
    );
  };

  return (
    <DropdownButton
      componentProps={{
        children: isLoading ? (
          <>
            <Spinner className="me-1" size="sm" />
            Exporting
          </>
        ) : (
          <>
            Export{" "}
            {selectedCount > 0
              ? `${selectedCount} rule${selectedCount > 1 ? "s" : ""}`
              : "selected"}
          </>
        ),
        className: "btn btn-primary",
        disabled: isLoading || selectedCount === 0,
        "data-testid": "export-modal-dropdown-button",
      }}
      menuContent={
        <DropdownMenuContainer data-testid="export-modal-dropdown-menu">
          <MenuItem
            startIcon="link"
            onClick={handleExportLink}
            data-testid="export-modal-dropdown-menu-create-link-button"
          >
            Create shareable link
          </MenuItem>
          <MenuItem
            startIcon="download"
            onClick={handleExportFile}
            data-testid="export-modal-dropdown-menu-create-file-button"
          >
            Download file locally
          </MenuItem>
        </DropdownMenuContainer>
      }
    />
  );
}
