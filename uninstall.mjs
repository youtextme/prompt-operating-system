#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { uninstallPromptOs } from "./kernel/scripts/uninstall.mjs";

uninstallPromptOs();
