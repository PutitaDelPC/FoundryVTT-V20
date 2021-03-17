/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
import { systemHandle, systemName } from './utils.js';

export class VampireActorSheet extends ActorSheet {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: [ systemHandle, 'sheet', 'actor' ],
            template: `systems/${systemName}/templates/character.html`,
            width: 940,
            height: 620,
            tabs: [
                {
                    navSelector: '.sheet-navigation',
                    contentSelector: '.sheet-body',
                    initial: 'attributes'
                }
            ],
            dragDrop: [ { dragSelector: '.item-list .item', dropSelector: null } ],
            rollDifficulty: 6,
            selectedAttribute: null,
            selectedAbility: null,
            selectedRoll: null,
            editMode: false
        });
    }

    /** @override */
    getData() {
        const data = super.getData();
        const advantages = { ...data.data.advantages };
        const { selectedAbility, selectedAttribute } = this.options;

        const filterActivated = (obj) => {
            const newObject = {};
            for (const key in obj) {
                if (obj[key].activated) {
                    newObject[key] = obj[key];
                }
            }
            return newObject;
        };
        advantages.disciplines = filterActivated(advantages.disciplines);
        advantages.backgrounds = filterActivated(advantages.backgrounds);

        data.data.advantages = advantages;

        // get localized strings of selected attribute
        const attribute = this.actor.getAttribute(selectedAttribute);
        if (attribute) {
            data.selectedAttribute = selectedAttribute;
            data.selectedAttributeLabel = game.i18n.localize(attribute.label);
        }

        // get localized strings of selected ability
        const ability = this.actor.getAbility(selectedAbility);
        if (ability) {
            data.selectedAbility = selectedAbility;
            data.selectedAbilityLabel = game.i18n.localize(ability.label);
        }

        // get localized strings of selected roll (depends on attribute/ability selected)
        if (attribute && ability) {
            data.selectedRoll = data.selectedAttributeLabel + ' + ' + data.selectedAbilityLabel;
        } else if (attribute) {
            data.selectedRoll = data.selectedAttributeLabel;
        } else if (ability) {
            data.selectedRoll = data.selectedAbilityLabel;
        } else {
            data.selectedRoll = game.i18n.localize('DIFFICULTY.CHOOSEROLL');
        }

        console.log(data);

        return data;
    }

    /** @override */
    render() {
        super.render(arguments);
    }

    /** @override */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();

        // Edit mode button to toggle which interactive elements are visible on the sheet.
        const canConfigure = game.user.isGM || this.actor.owner;
        if (this.options.editable && canConfigure) {
            buttons = [
                {
                    label: game.i18n.localize('SHEET.EDITMODE'),
                    class: 'toggle-edit-mode',
                    icon: 'fas fa-edit',
                    onclick: (ev) => this._onToggleEditMode(ev)
                }
            ].concat(buttons);
        }

        return buttons;
    }

    /**
   * OnClick handler for the previously declaried "Edit mode" button.
   * Toggles the 'helper--enable-editMode' class for the sheet container.
   */
    _onToggleEditMode(e) {
        e.preventDefault();

        const target = $(e.currentTarget);
        const app = target.parents('.app');
        const html = app.find('.window-content');

        html.toggleClass('helper--enable-editMode');
        this.options.editMode = !this.options.editMode || false;

        if (this.options.editMode) {
            this.unselectAbility();
            this.unselectAttribute();

            target[0].innerText = game.i18n.localize('SHEET.CLOSEEDITMODE');
        } else {
            target[0].innerText = game.i18n.localize('SHEET.EDITMODE');
        }

        this.render();
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        html.find('.item').find('input[type="radio"]').change((event) => {
            console.log(event);
            this._onSubmit(event);
        });

        // listen to attribute label click -> toggle attribute
        html.find('.attribute-value').mouseup((ev) => {
            if (this.options.editMode) return;

            const attribute = $(ev.currentTarget).parents('.item').attr('data-item-key');

            if (attribute === this.getSelectedAttribute()) {
                this.unselectAttribute();
            } else {
                this.selectAttribute(attribute);
            }

            this.render();
        });

        // listen to ability label click -> toggle ability
        html.find('.ability-value').mouseup((ev) => {
            if (this.options.editMode) return;

            const ability = $(ev.currentTarget).parents('.item').attr('data-item-key');

            if (ability === this.getSelectedAbility()) {
                this.unselectAbility();
            } else {
                this.selectAbility(ability);
            }

            this.render();
        });

        // listen to submit roll click
        html.find('#btn-roll-submit').click(() => {
            if (!this.getSelectedAttribute() && !this.getSelectedAbility()) return;

            const difficulty = parseInt(html.find('#input-roll-difficulty').find('input').val());

            this.setRollDifficulty(difficulty);

            DicePoolVTM20.rollTest(
                {
                    actor: this.actor,
                    attribute: this.getSelectedAttribute(),
                    ability: this.getSelectedAbility(),
                    difficulty: difficulty
                },
                this.getSelectedAbility() ? false : true
            );

            this.unselectAttribute();
            this.unselectAbility();
            this.render();
        });

        // listen to button save roll click
        html.find('#btn-roll-save').click(() => {
            const attributeKey = this.getSelectedAttribute();
            const abilityKey = this.getSelectedAbility();
            const attribute = this.actor.getAttribute(attributeKey);
            const ability = this.actor.getAbility(abilityKey);

            const name = `${game.i18n.localize(attribute.label)} + ${game.i18n.localize(ability.label)}`;
            let item = game.items.entities.find((e) => e.name === name);
            if (!item) {
                item = Item.create(
                    {
                        actor: this.actor,
                        attribute,
                        ability,
                        name,
                        type: 'macro'
                    },
                    { renderSheet: true }
                );
            }

            this.render();

            // add the item to the macro bar
        });

        // listen to button cancel click
        html.find('#btn-roll-cancel').click(() => {
            this.unselectAttribute();
            this.unselectAbility();
            this.render();
        });

        // listen to slider changes
        html.find('#input-roll-difficulty').find('input').on('input', (ev) => {
            const value = $(ev.currentTarget).val();
            html.find('#input-roll-difficulty').find('h2').text(value);
        });
        html.find('#input-roll-difficulty').find('input').on('change', (ev) => {
            const value = parseInt($(ev.currentTarget).val());
            this.setRollDifficulty(value);
            this.render();
        });
    }

    render() {
        super.render(...arguments);
    }

    /** @override */
    _updateObject(event, formData) {
        // Handle the free-form attributes list
        const formAttrs = expandObject(formData).data.attributes || {};

        // Remove attributes which are no longer used
        for (let k of Object.keys(this.object.data.data.attributes)) {
            if (!formAttrs.hasOwnProperty(k)) formAttrs[`-=${k}`] = null;
        }

        // Re-combine formData
        formData = Object.entries(formData).filter((e) => !e[0].startsWith('data.attributes')).reduce((obj, e) => {
            obj[e[0]] = e[1];
            return obj;
        }, { _id: this.object._id, 'data.attributes': formAttrs });

        // Update the Actor
        return this.object.update(formData);
    }

    // local state
    getSelectedAttribute() {
        return this.options.selectedAttribute;
    }
    selectAttribute(value) {
        this.options.selectedAttribute = value;
    }
    unselectAttribute() {
        this.options.selectedAttribute = null;
    }

    getSelectedAbility() {
        return this.options.selectedAbility;
    }
    selectAbility(value) {
        this.options.selectedAbility = value;
    }
    unselectAbility() {
        this.options.selectedAbility = null;
    }

    getRollDifficulty() {
        return this.options.rollDifficulty;
    }
    setRollDifficulty(value) {
        this.options.rollDifficulty = value;
    }
}
