//-----------------------------------------------------------------------------
// Game_CharacterBase
//
// The superclass of Game_Character. It handles basic information, such as
// coordinates and images, shared by all characters.

const uuid = require('uuid');

Game_CharacterBase.DEFAULT_HITBOX_RADIUS = Number(PluginManager.parameters('FreeMove')['character hitbox radius']) || 0.5;

Game_CharacterBase.prototype.isDiagonal = dir => dir % 2 === 1;
Game_CharacterBase.prototype.isLeft = dir => dir % 3 === 1;
Game_CharacterBase.prototype.isRight = dir => dir % 3 === 0;
Game_CharacterBase.prototype.isUp = dir => dir > 6;
Game_CharacterBase.prototype.isDown = dir => dir < 4;
Game_CharacterBase.prototype.dirFromDxDy = (dx, dy) => {
  let dir = dx < 0 ? 4 : dx > 0 ? 6 : null;
  if (dir) dir = dy > 0 ? dir - 3 : dy < 0 ? dir + 3 : dir;
  else dir = dy > 0 ? 2 : dy < 0 ? 8 : null;
  return dir;
}


Object.defineProperties(Game_CharacterBase.prototype, {
  id: { get: function() { return this._id          }, configurable: true },
  x1: { get: function() { return this.hitbox().x1; }, configurable: true },
  x2: { get: function() { return this.hitbox().x2; }, configurable: true },
  y1: { get: function() { return this.hitbox().y1; }, configurable: true },
  y2: { get: function() { return this.hitbox().y2; }, configurable: true }
});

/*
  _id             : used in hash map in Game_Map to track characters in the spatial map
  _autoDx         : movement determined in the x-axis
  _autoDy         : movement determined in the y-axis
  _lastDir        : used to determine appropriate 4-dir in 8-dir movement
  _hitboxRadius   : used to calculate square hitbox dimensions
*/
const _Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
Game_CharacterBase.prototype.initMembers = function() {
  _Game_CharacterBase_initMembers.call(this);
  this._id = uuid();
  this.resetAutoMovement();
  this._lastDir = 2;
  this._hitboxRadius = this.hitboxRadius();
};

Game_CharacterBase.prototype.resetAutoMovement = function() {
  this._autoDx = this._autoDy = 0;
};

// 
const _Game_CharacterBase_isMoving = Game_CharacterBase.prototype.isMoving;
Game_CharacterBase.prototype.isMoving = function() {
  return _Game_CharacterBase_isMoving.call(this) || this._autoDx || this._autoDy;
};

// based on pythagorean theorem
Game_CharacterBase.prototype.distancePerFrameDiagonal = function() {
  return Math.round4(this.distancePerFrame() * Math.sqrt(2) / 2);
};

// accommodate 8-dir 
Game_CharacterBase.prototype.setDirection = function(dir) {
  if (this.isDirectionFixed() || !dir) return;
  if (this._lastDir !== dir) {
    if (this.isDiagonal(dir)) {
      switch(this.direction()) {
        case 2: // down 
          if (this.isLeft(dir)) this._direction = 4;
          else if (this.isRight(dir)) this._direction = 6;
          break;
        case 4: // left
          if (this.isUp(dir)) this._direction = 8;
          else if (this.isDown(dir)) this._direction = 2;
          break;
        case 6: // right
          if (this.isUp(dir)) this._direction = 8;
          else if (this.isDown(dir)) this._direction = 2;
          break;
        case 8: // up
          if (this.isLeft(dir)) this._direction = 4;
          else if (this.isRight(dir)) this._direction = 6;
          break;
      }
    } else {
      this._direction = dir;
    }
  }
  this._lastDir = dir;
  this.resetStopCount();
};

const _Game_CharacterBase_update = Game_CharacterBase.prototype.update;
Game_CharacterBase.prototype.update = function() {
  const prevX = this.x;
  const prevY = this.y;
  _Game_CharacterBase_update.call(this);
  if (prevX !== this.x || prevY !== this.y) {
    this.updateSpatialMap(this);
  }
  this.updateAutoMove(this.x - prevX, this.y - prevY);
};

const _Game_CharacterBase_updateMove = Game_CharacterBase.prototype.updateMove;
Game_CharacterBase.prototype.updateMove = function() {
  if (this._autoDx || this._autoDy) {
    this._x += this.truncateDxByCollision(this.dxThisFrame());
    this._y += this.truncateDyByCollision(this.dyThisFrame());
  }
  _Game_CharacterBase_updateMove.call(this);
};

Game_CharacterBase.prototype.dxThisFrame = function() {
  const distance = this.distancePerFrame();
  const scalar = Math.abs(this._autoDx) + Math.abs(this._autoDy);
  return Math.round4(distance * this._autoDx / scalar);
};

Game_CharacterBase.prototype.dyThisFrame = function() {
  const distance = this.distancePerFrame();
  const scalar = Math.abs(this._autoDx) + Math.abs(this._autoDy);
  return Math.round4(distance * this._autoDy / scalar);
};

Game_CharacterBase.prototype.truncateDxByCollision = function(dx) {
  if (!dx) return dx;
  const minX = dx > 0 ? this.x2 : this.x1 + dx; 
  const maxX = dx > 0 ? this.x2 + dx : this.x1;
  
  const collisions = $gameMap.collisionsInBoundingBox(minX, maxX, this.y1, this.y2);
  const nearestCollisionsX = collisions
    .filter(obj => dx > 0 ? obj.x1 >= this.x2 : obj.x2 <= this.x1)
    .filter(obj => !(obj.y2 < this.y1 || this.y2 < obj.y1))
    .map(obj => dx > 0 ? obj.x1 : obj.x2)
    .sort((a, b) => dx > 0 ? a - b : b - a);
  if (!nearestCollisionsX.length) return dx;
  return Math.round4(dx > 0 ? Math.min(dx, nearestCollisionsX[0] - this.x2 - 0.0001) : Math.max(dx, nearestCollisionsX[0] - this.x1));
};

Game_CharacterBase.prototype.truncateDyByCollision = function(dy) {
  if (!dy) return dy;
  const minY = dy > 0 ? this.y2 : this.y1 + dy;
  const maxY = dy > 0 ? this.y2 + dy : this.y1;

  const collisions = $gameMap.collisionsInBoundingBox(this.x1, this.x2, minY, maxY);
  const nearestCollisionsY = collisions
    .filter(obj => dy > 0 ? obj.y1 >= this.y2 : obj.y2 <= this.y1)
    .filter(obj => !(obj.x2 < this.x1 || this.x2 < obj.x1))
    .map(obj => dy > 0 ? obj.y1 : obj.y2)
    .sort((a, b) => dy > 0 ? a - b : b - a);
  if (!nearestCollisionsY.length) return dy;
  return Math.round4(dy > 0 ? Math.min(dy, nearestCollisionsY[0] - this.y2 - 0.0001) : Math.max(dy, nearestCollisionsY[0] - this.y1));
};

Game_CharacterBase.prototype.updateAutoMove = function(dx, dy) {
  this.progressAutoMove(this.dxThisFrame(), this.dyThisFrame());
};

Game_CharacterBase.prototype.progressAutoMove = function(dx, dy) {
  if (this._autoDx) {
    if (Math.sign(this._autoDx) !== Math.sign(this._autoDx - dx)) this._autoDx = 0;
    else this._autoDx -= dx;
  }
  if (this._autoDy) {
    if (Math.sign(this._autoDy) !== Math.sign(this._autoDy - dy)) this._autoDy = 0;
    else this._autoDy -= dy;
  }
};

// now takes single character argument
Game_CharacterBase.prototype.checkEventTriggerTouch = function(character) {
  return false;
};

Game_CharacterBase.prototype.moveFree = function(dir) {
  const distance = this.isDiagonal(dir) ? this.distancePerFrameDiagonal() : this.distancePerFrame();
  const dx = this.isLeft(dir) ? -distance : this.isRight(dir) ? distance : 0;
  const dy = this.isUp(dir) ? -distance : this.isDown(dir) ? distance : 0;
  this.autoMove(dx, dy);
};

Game_CharacterBase.prototype.autoMove = function(dx, dy) {
  if (!dx && !dy) return;
  this.setDirection(this.dirFromDxDy(dx, dy));
  this._autoDx = dx;
  this._autoDy = dy;
};

Game_CharacterBase.prototype.moveStraight = function(dir) {
  const dx = this.isLeft(dir) ? -1 : this.isRight(dir) ? 1 : 0;
  const dy = this.isUp(dir) ? -1 : this.isDown(dir) ? 1 : 0;
  this.autoMove(dx, dy);
};

Game_CharacterBase.prototype.isEvent = function() {
  return false;
};

// get hitbox dimensions
Game_CharacterBase.prototype.hitbox = function() {
  return {
    x1: this.x + 0.5 - this.hitboxRadius(),
    x2: this.x + 0.5 + this.hitboxRadius(),
    y1: this.y + 1 - this.hitboxRadius() * 2,
    y2: this.y + 1,
  };
};

// distance from center of characters used to calculate square hitbox
Game_CharacterBase.prototype.hitboxRadius = function() {
  return this.isTile() || this.isObjectCharacter() ? 0.5 : this._hitboxRadius || Game_CharacterBase.DEFAULT_HITBOX_RADIUS;
};

Game_CharacterBase.prototype.updateSpatialMap = function() {
  if ($gameMap) $gameMap.spatialMapUpdateEntity(this);
};
