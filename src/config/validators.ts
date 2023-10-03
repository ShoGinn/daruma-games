import { isValidAddress, seedFromMnemonic } from 'algosdk';
import convict from 'convict';
import isString from 'lodash/isString.js';

function isValidMnemonic(mnemonic: string): boolean {
	try {
		seedFromMnemonic(mnemonic);
		return true;
	} catch {
		return false;
	}
}
export const mnemonicFormat: convict.Format = {
	validate: (value) => {
		if (!isValidMnemonic(value)) {
			throw new Error(`Mnemonic '${value}' is not valid`);
		}
	},
};
export const validAlgoAddressFormat: convict.Format = {
	validate: (value) => {
		if (!isValidAddress(value)) {
			throw new Error(`Address '${value}' is not valid`);
		}
	},
};
export const webhookUrlValidator: convict.Format = {
	validate: (value) => {
		const regex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]{68}$/;
		if (!regex.test(value)) {
			throw new Error('Invalid webhook URL');
		}
	},
};
export const nonEmptyString: convict.Format = {
	validate: (value) => {
		if (!isString(value) || value === '') {
			throw new Error('must be a non-empty string');
		}
	},
};
