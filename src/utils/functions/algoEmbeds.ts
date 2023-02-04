import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageActionRowComponentBuilder,
} from 'discord.js';

/**
 * Creates a simple yes/no button row.
 *
 * @export
 * @param {string} btnId
 * @returns {*}  {ActionRowBuilder<MessageActionRowComponentBuilder>}
 */
export function buildYesNoButtons(
    btnId: string
): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const yesButton = new ButtonBuilder()
        .setCustomId(`simple-yes_${btnId}`)
        .setEmoji('✅')
        .setStyle(ButtonStyle.Primary);

    const noButton = new ButtonBuilder()
        .setCustomId(`simple-no_${btnId}`)
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        yesButton,
        noButton
    );
}
/**
 * Builds an action row with add and remove buttons.
 *
 * @param buttonId - The custom ID of the buttons.
 * @param buttonName - The name of the buttons.
 * @param includeRemoveButton - Flag indicating if the remove button should be included.
 * @returns An action row builder with add and remove buttons.
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
 * @param buttonId - The custom ID of the button.
 * @param buttonName - The name of the button.
 * @returns The add button.
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
 * @param buttonId - The custom ID of the button.
 * @param buttonName - The name of the button.
 * @returns The remove button.
 */
const buildRemoveButton = (buttonId: string, buttonName: string): ButtonBuilder => {
    return new ButtonBuilder()
        .setCustomId(`simple-remove-${buttonName}_${buttonId}`)
        .setEmoji('➖')
        .setStyle(ButtonStyle.Danger);
};

export function customButton(btnId: string, label: string): ButtonBuilder {
    const customButton = new ButtonBuilder()
        .setCustomId(`custom-button_${btnId}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary);
    return customButton;
}
