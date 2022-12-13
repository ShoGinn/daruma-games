import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageActionRowComponentBuilder,
} from 'discord.js';

export function yesNoButtons(btnId: string): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const yesButton = new ButtonBuilder()
        .setCustomId(`simple-yes_${btnId}`)
        .setEmoji('✅')
        .setStyle(ButtonStyle.Primary);

    const noButton = new ButtonBuilder()
        .setCustomId(`simple-no_${btnId}`)
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        yesButton,
        noButton
    );
    return buttonRow;
}
export function addRemoveButtons(
    btnId: string,
    namedFunction: string,
    noRemove: boolean = false
): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const addButton = new ButtonBuilder()
        .setCustomId(`simple-add-${namedFunction}_${btnId}`)
        // Plus Emoji
        .setEmoji('➕')
        .setStyle(ButtonStyle.Primary);

    if (noRemove)
        return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(addButton);

    const removeButton = new ButtonBuilder()
        .setCustomId(`simple-remove-${namedFunction}_${btnId}`)
        // Minus Emoji
        .setEmoji('➖')
        .setStyle(ButtonStyle.Danger);

    const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        addButton,
        removeButton
    );
    return buttonRow;
}
export function defaultButton(btnId: string): ButtonBuilder {
    const defaultButton = new ButtonBuilder()
        .setCustomId(`default-button_${btnId}`)
        .setLabel('Set Default')
        .setStyle(ButtonStyle.Secondary);
    return defaultButton;
}
export function customButton(btnId: string, label: string): ButtonBuilder {
    const customButton = new ButtonBuilder()
        .setCustomId(`custom-button_${btnId}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary);
    return customButton;
}
