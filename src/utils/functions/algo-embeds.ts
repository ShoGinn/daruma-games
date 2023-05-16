import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageActionRowComponentBuilder,
} from 'discord.js';

/**
 * Creates a simple yes/no button row.
 *

 * @param {string} buttonId
 * @returns {*}  {ActionRowBuilder<MessageActionRowComponentBuilder>}
 */
export function buildYesNoButtons(
    buttonId: string
): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const yesButton = new ButtonBuilder()
        .setCustomId(`simple-yes_${buttonId}`)
        .setEmoji('✅')
        .setStyle(ButtonStyle.Primary);

    const noButton = new ButtonBuilder()
        .setCustomId(`simple-no_${buttonId}`)
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        yesButton,
        noButton
    );
}
/**
 * Builds an add/remove button row.
 *
 * @param {string} buttonId
 * @param {string} buttonName
 * @param {boolean} [includeRemoveButton=false]
 * @returns {*}  {ActionRowBuilder<MessageActionRowComponentBuilder>}
 */
export function buildAddRemoveButtons(
    buttonId: string,
    buttonName: string,
    includeRemoveButton: boolean = false
): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const addButton = buildAddButton(buttonId, buttonName);
    if (!includeRemoveButton) {
        return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(addButton);
    }
    const removeButton = buildRemoveButton(buttonId, buttonName);
    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        addButton,
        removeButton
    );
}

/**
 * Builds an add button.
 *
 * @param {string} buttonId
 * @param {string} buttonName
 * @returns {*}  {ButtonBuilder}
 */
const buildAddButton = (buttonId: string, buttonName: string): ButtonBuilder => {
    return new ButtonBuilder()
        .setCustomId(`simple-add-${buttonName}_${buttonId}`)
        .setEmoji('➕')
        .setStyle(ButtonStyle.Primary);
};

/**
 * Builds a remove button.
 *
 * @param {string} buttonId
 * @param {string} buttonName
 * @returns {*}  {ButtonBuilder}
 */
const buildRemoveButton = (buttonId: string, buttonName: string): ButtonBuilder => {
    return new ButtonBuilder()
        .setCustomId(`simple-remove-${buttonName}_${buttonId}`)
        .setEmoji('➖')
        .setStyle(ButtonStyle.Danger);
};

export function customButton(buttonId: string, label: string): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(`custom-button_${buttonId}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary);
}
