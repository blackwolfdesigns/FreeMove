//-----------------------------------------------------------------------------
// Game_Player
//
// The game object class for the player. It contains event starting
// determinants and map scrolling functions.


Game_Player.prototype.updateAutoMove = function(dx, dy, updateByActualDistance = false) {
    if (dx || dy) $gameParty.increaseSteps(Math.abs(dx) + Math.abs(dy));
    Game_Character.prototype.updateAutoMove.call(this, dx, dy, updateByActualDistance);
};

// overwritten
Game_Player.prototype.getInputDirection = function() {
    return Input.dir8;
};

// overwritten
Game_Player.prototype.executeMove = function(direction) {
    this.moveFree(direction);
};

// now takes single character argument
Game_Player.prototype.checkEventTriggerTouch = function(character) {
    if (!$gameMap.isEventRunning() && !this.isJumping()) {
        if (character.isEvent() && character.isTriggerIn([1, 2])) {
            this.resetAutoMovement();
            character.start();
        }
    }
};
