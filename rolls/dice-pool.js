/**
 * This class is the center for generating dice pools either by manually combining
 * attributes and abilities, by reusing already rolled tests or by creating a macro out
 * of an existing dice pool
 */
class DicePoolVTM20 {

  static rollTest(testData = {}, onlyAttribute = false) {
    const {
      actor = game.user.character,
      attribute = "strength",
      ability = "athletics",
      difficulty = 6,
      title
    } = testData;

    console.log({ testData })

    const modifier = 0;
    const nan = { value: 0 };
    const attributeDice = actor.getAttribute(attribute) || nan;
    const abilityDice = actor.getAbility(ability) || nan;
    const diceCount = onlyAttribute ?
      parseInt(attributeDice.value) + modifier :
      parseInt(attributeDice.value) + parseInt(abilityDice.value) + modifier;

    let formula = `${diceCount}d10`;
    if (abilityDice.value >= 4)
      formula = formula.concat('xo10');

    const roll = new Roll(formula).roll();
    const dice = roll.dice[0].results;
    const fails = dice.filter((d) => d.result === 1).length;
    const wins = dice.filter((d) => d.result >= difficulty).length;
    const isCritFail = wins === 0 && fails > 0;
    const success = wins - fails;

    let message;
    let result;

    if (isCritFail) {
      message = `${actor.name} ${game.i18n.localize("DEGREES.GETBOTCH")}`;
      result = game.i18n.localize("DEGREES.BOTCH");
    } else if (success <= 0) {
      message = `${actor.name} ${game.i18n.localize("DEGREES.GETFAILURE")}`;
      result = game.i18n.localize("DEGREES.FAILURE");
    } else {
      message = `${actor.name} ${game.i18n.localize("DEGREES.GET")}`;
      result = `${success} ${game.i18n.localize("DEGREES.SUCCESS")}`;
    }

    // Render the roll for the results button that Foundry provides.
    let rollMode = game.settings.get("core", "rollMode") || "roll";

    const chatData = {
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${message}</p>`,
      rollMode: rollMode,
      details: message,
      roll,
    };

    let template = 'systems/foundryvtt-vtm-20th/templates/chat/roll.html';
    const attributeLabel = game.i18n.localize(attributeDice.label);
    const abilityLabel = game.i18n.localize(abilityDice.label);
    const difficultyLabel = game.i18n.localize(`DIFFICULTY.${difficulty}`);
    const difficultyMessage = `${game.i18n.localize("DIFFICULTY.WAS")} ${difficultyLabel}`;
    const poolConfig = onlyAttribute ? attributeLabel : `${attributeLabel} + ${abilityLabel}`

    let templateData = {
      title: title ? title : poolConfig,
      message,
      rolls: roll.dice[0].results,
      formula,
      difficulty,
      difficultyMessage,
      result,
      success,
      diceCount,
      poolConfig: title ? poolConfig : ""
    };

    // Handle roll visibility. Blind doesn't work, you'll need a render hook to hide it.
    if (["gmroll", "blindroll"].includes(rollMode))
      chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user._id];
    if (rollMode === "blindroll") chatData["blind"] = true;

    roll.render().then((r) => {
      templateData.roll = r;
      chatData.roll = JSON.stringify(r);

      // Render our roll chat card
      renderTemplate(template, templateData).then(content => {
        
        chatData.content = content;
        
        // Hook into Dice So Nice!
        if (game.dice3d) {
          game.dice3d
            .showForRoll(roll, game.user, true, chatData.whisper, chatData.blind)
            .then((displayed) => {
              ChatMessage.create(chatData);
            });
        }
        // Roll normally, add a dice sound
        else {
          chatData.sound = CONFIG.sounds.dice;
          ChatMessage.create(chatData);
        }
      });
    });
  }
}
