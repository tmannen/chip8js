var memory = new Uint8Array(4096);
var screen = new Uint8Array(64*36);
var stack = new Uint16Array(16);
var key = new Uint8Array(16);
var scale = 10;
var stack_pointer; //just an index to stack?
var drawFlag = false;

var V = new Uint8Array(16); //registers

var opcode;
var I; //index register, can/should these be typed?
var pc; //program counter
var delay_timer;
var sound_timer;

// the game in chip 8 opcodes as string
var pong = "6a02 6b0c 6c3f 6d0c a2ea dab6 dcd6 6e00 \
22d4 6603 6802 6060 f015 f007 3000 121a \
c717 7708 69ff a2f0 d671 a2ea dab6 dcd6 \
6001 e0a1 7bfe 6004 e0a1 7b02 601f 8b02 \
dab6 600c e0a1 7dfe 600d e0a1 7d02 601f \
8d02 dcd6 a2f0 d671 8684 8794 603f 8602 \
611f 8712 4602 1278 463f 1282 471f 69ff \
4700 6901 d671 122a 6802 6301 8070 80b5 \
128a 68fe 630a 8070 80d5 3f01 12a2 6102 \
8015 3f01 12ba 8015 3f01 12c8 8015 3f01 \
12c2 6020 f018 22d4 8e34 22d4 663e 3301 \
6603 68fe 3301 6802 1216 79ff 49fe 69ff \
12c8 7901 4902 6901 6004 f018 7601 4640 \
76fe 126c a2f2 fe33 f265 f129 6414 6500 \
d455 7415 f229 d455 00ee 8080 8080 8080 \
8000 0000 0000"

//fontset and some hints from http://www.multigesture.net/articles/how-to-write-an-emulator-chip-8-interpreter/
var chip8_fontset = [0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80] // F

function initialize() {
        pc = 0x200; //In original chip8 the chip8 itself is stored in the first 512 bytes
        opcode = 0;
        I = 0;
        stack_pointer = 0;
        delay_timer = 0;
        sound_timer = 0;
        memory.fill(0);
        V.fill(0);
        stack.fill(0);
        screen.fill(0);
        key.fill(0);
    
        for(i = 0; i < 80; ++i) memory[i] = chip8_fontset[i];
    }

//just pong for now, from string, does javascript have an easier way to read bytes?
function loadGame() {
    pong = pong.replace(/ /g, '');
    for(i = 0; i+1 < pong.length; i = i+2) {
        memory[0x200 + i/2] = parseInt("0x" + pong.slice(i, i+2));
    }
}

function emulateCycle() {
    opcode = memory[pc] << 8 | memory[pc + 1];

    switch(opcode & 0xF000) {
        case 0x0000:
            switch(opcode & 0x000F) {
                case 0x0000: //00E0: Clears the screen. E doesn't matter here.
                    screen.fill(0);
                    drawFlag = true;
                    pc += 2;
                    break;
                case 0x000E: //00EE: Returns from a subroutine.
                    stack_pointer--;
                    pc = stack[stack_pointer];
                    stack[stack_pointer] = 0;
                    pc += 2; //needed i think? because for ex in 0x2NNN we don't want to run the command again?
                    break;
                default:
                    console.log("opcode " + opcode + "is not recognized.");

            }
            break;

        case 0x1000: //Jumps to address NNN. same as 0x200 except no need for stack?
            pc = opcode & 0x0FFF;
            break;

        case 0x2000: //Calls subroutine at NNN.
            stack[stack_pointer] = pc;
            stack_pointer++;
            pc = opcode & 0x0FFF;
            break;

        case 0x3000: //Skips the next instruction if VX equals NN. (Usually the next instruction is a jump to skip a code block)
            if (V[(opcode & 0x0f00) >> 8] == (opcode & 0x00ff)) pc += 4;
            else pc += 2;
            break;
        case 0x4000: //Skips the next instruction if VX doesn't equal NN. (Usually the next instruction is a jump to skip a code block)
            if (V[(opcode & 0x0f00) >> 8] != (opcode & 0x00ff)) pc += 4;
            else pc += 2;
            break;
        case 0x5000: //Skips the next instruction if VX equals VY. (Usually the next instruction is a jump to skip a code block)
            if (V[(opcode & 0x0f00) >> 8] == V[(opcode & 0x00f0) >> 4]) pc += 4;
            else pc += 2; 
            break;
        case 0x6000: //Sets VX to NN.
            V[(opcode & 0x0f00) >> 8] = (opcode & 0x00ff);
            pc += 2;
            break;
        case 0x7000: //Adds NN to VX. (Carry flag is not changed)
            V[(opcode & 0x0f00) >> 8] += (opcode & 0x00ff);
            pc += 2;
            break;
        case 0x8000:
            var X = (opcode & 0x0f00) >> 8;
            var Y = (opcode & 0x00f0) >> 4;

            switch (opcode & 0x000F) {
                case 0x0: //Sets VX to the value of VY.
                    V[X] = V[Y];
                    break;
                case 0x1: //Sets VX to VX or VY. (Bitwise OR operation)
                    V[X] = V[X] | V[Y];
                    break;
                case 0x2: //Sets VX to VX and VY. (Bitwise AND operation)
                    V[X] = V[X] & V[Y];
                    break;
                case 0x3: //Sets VX to VX xor VY.
                    V[X] = V[X] ^ V[Y];
                    break;
                case 0x4: //Adds VY to VX. VF is set to 1 when there's a carry, and to 0 when there isn't.
                    if (V[Y] > (0xFF - V[X])) V[0xF] = 1;
                    else V[0xF] = 0;
                    V[X] += V[Y];
                    break;
                case 0x5: //VY is subtracted from VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
                    if (V[X] < V[Y]) V[0xF] = 0;
                    else V[0xF] = 1;
                    V[X] -= V[Y];
                    break;
                case 0x6: //Shifts VY right by one and stores the result to VX (VY remains unchanged).
                    //VF is set to the value of the least significant bit of Y before the shift. wiki has footnote?
                    V[0xF] = V[X] & 1;
                    V[X] = V[X] >> 1;
                    break;
                case 0x7: //Sets VX to VY minus VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
                    if (V[Y] < V[X]) V[0xF] = 0;
                    else V[0xF] = 1;
                    V[X] = V[Y] - V[X];
                    break;
                case 0xE: //Shifts VY left by one and copies the result to VX.
                    //VF is set to the value of the most significant bit of Y before the shift.
                    V[0xF] = V[X] >> 7;
                    V[X] = V[X] << 1;
                    break;
                default:
                    console.log("opcode " + opcode + "is not recognized.");
            }

            pc += 2;
            break;

        case 0x9000: //Skips the next instruction if VX doesn't equal VY.
            if (V[(opcode & 0x0f00) >> 8] != V[(opcode & 0x00f0) >> 4]) pc += 4;
            else pc += 2;
            break;
        
        case 0xA000: //Sets I to the address NNN.
            I = opcode & 0x0FFF;
            pc += 2;
            break;
        case 0xB000: //Jumps to the address NNN plus V0.
            pc = (opcode & 0x0FFF) + V[0];
            break;
        case 0xC000: //Sets VX to the result of a bitwise and operation on a random number (Typically: 0 to 255) and NN.
            V[(opcode & 0x0f00) >> 8] = (opcode & 0x00FF) & Math.floor(Math.random(0, 255));
            pc += 2;
            break;
        case 0xD000:
            /*
            Draws a sprite at coordinate (VX, VY) that has a width of 8 pixels and a height of N pixels.
            Each row of 8 pixels is read as bit-coded starting from memory location I;
            I value doesn’t change after the execution of this instruction.
            VF is set to 1 if any screen pixels are flipped from set to unset when the sprite 
            is drawn, and to 0 if that doesn’t happen
            */
            
            var X = (opcode & 0x0f00) >> 8;
            var Y = (opcode & 0x00f0) >> 4;
            var N = opcode & 0x000f;
            var start = V[X] + V[Y] * 64;
            V[0xF] = 0; //default 0, only 1 if pixels are flipped
            for (i = 0; i < N; i++) {
                var row = memory[I+i]; //row of 8 pixels
                var exp = 7; //2**3 for ex gives binary of 1000, se we can use this for getting the 4th bit
                for (j = 0; j < 8; j++) {
                    var pixel = (row & (2**exp)) >> exp; //get pixel value of jth bit?
                    if (pixel != 0) {
                        if (screen[start + j + i*64] == 1) V[0xF] = 1;
                    }
                    screen[start + j + i*64] = screen[start + j + i*64] ^ pixel;
                    exp -= 1;
                }
        
            }

            drawFlag = true;
            pc += 2;
            break;
        case 0xE000:
            switch (opcode & 0x00FF) {
                case 0x9E: //Skips the next instruction if the key stored in VX is pressed.
                    if (key[V[(opcode & 0x0f00) >> 8]] != 0) pc += 4;
                    else pc += 2;
                    break;
                case 0xA1: //Skips the next instruction if the key stored in VX isn't pressed.
                    if (key[V[(opcode & 0x0f00) >> 8]] == 0) pc += 4;
                    else pc += 2;
                    break;
                default:
                    console.log("opcode " + opcode + "is not recognized.");
            }
            break;
        case 0xF000:
            switch (opcode & 0x00FF) {
                case 0x07: //Sets VX to the value of the delay timer.
                    V[(opcode & 0x0f00) >> 8] = delay_timer;
                    break;
                case 0x0A: //A key press is awaited, and then stored in VX. (Blocking Operation. All instruction halted until next key event)
                    var keypress = false;
                    for (var i=0; i < 16; i++) {
                        if (key[i] != 0) {
                            V[(opcode & 0x0f00) >> 8] = i;
                            keypress = true;
                        }
                    }

                    if (!keypress) return;
                    
                    pc += 2;
                    break;
                case 0x15: //Sets the delay timer to VX.
                    delay_timer = V[(opcode & 0x0f00) >> 8];
                    break;
                case 0x18: //Sets the sound timer to VX.
                    sound_timer = V[(opcode & 0x0f00) >> 8];
                    break;
                case 0x1e: //Adds VX to I.
                    I += V[(opcode & 0x0f00) >> 8];
                    break;
                case 0x29: //Sets I to the location of the sprite for the character in VX.
                    I = V[(opcode & 0x0f00) >> 8] * 5;
                    break;
                case 0x33:
                    /*
                    Stores the binary-coded decimal representation of VX, with the most significant of three digits at 
                    the address in I, the middle digit at I plus 1, and the least significant digit at I plus 2. 
                    (In other words, take the decimal representation of VX, place the hundreds digit in memory at 
                    location in I, the tens digit at location I+1, and the ones digit at location I+2.)
                    */
                    memory[I] = V[(opcode & 0x0f00) >> 8] / 100;
                    memory[I+1] = (V[(opcode & 0x0f00) >> 8] % 100) / 10;
                    memory[I+2] = V[(opcode & 0x0f00) >> 8] % 10;
                    break;
                case 0x55: //Stores V0 to VX (including VX) in memory starting at address I. I is increased by 1 for each value written.
                    for (i=0; i <= ((opcode & 0x0f00) >> 8); i++) {
                        memory[I+i] = V[i];
                    }
                    //On the original interpreter, when the operation is done, I = I + X + 1.
                    I += ((opcode & 0x0F00) >> 8) + 1;
                    break;
                case 0x65:
                //Fills V0 to VX (including VX) with values from memory starting at address I. I is increased by 1 for each value written.
                    for (i=0; i <= ((opcode & 0x0f00) >> 8); i++) {
                        V[i] = memory[I+i];
                    }
                    //On the original interpreter, when the operation is done, I = I + X + 1.
                    I += ((opcode & 0x0F00) >> 8) + 1;
                    break;
                default:
                    console.log("opcode " + opcode + "is not recognized.");
            }

            pc += 2;
            break;

        default:
            console.log("opcode " + opcode + "is not recognized.");
    }

    if(delay_timer > 0) delay_timer--;
    if(sound_timer > 0) {
        if(sound_timer == 1) console.log("BING!");
        sound_timer--;
    }
}

function drawGraphics() {
    var game = document.getElementById('game');
    var ctx = game.getContext('2d');
    ctx.clearRect(0, 0, 64*scale, 32*scale); //scale is basically how many actual pixels a chip8 pixel is
    for (coord=0; coord < 64*32; coord++) {
        if (screen[coord] == 1) {
            var x = (coord % 64)*scale;
            var y = Math.floor(coord / 64)*scale;
            ctx.fillRect(x, y, scale, scale);
        }
    }

    drawFlag = false;
}

function handleKeyPress(event) {
    var keyCode = event.keyCode;
    switch (keyCode) {
        case 49:
            key[1] = 1;
            break;
        case 50:
            key[2] = 1;
            break;
        case 51:
            key[3] = 1;
            break;
        case 52:
            key[12] = 1;
            break;
        case 81:
            key[4] = 1;
            break;
        case 87:
            key[5] = 1;
            break;
        case 69:
            key[6] = 1;
            break;
        case 82:
            key[13] = 1;
            break;
        case 65:
            key[7] = 1;
            break;
        case 83:
            key[8] = 1;
            break;
        case 68:
            key[9] = 1;
            break;
        case 70:
            key[14] = 1;
            break;
        case 90:
            key[10] = 1;
            break;
        case 88:
            key[0] = 1;
            break;
        case 67:
            key[11] = 1;
            break;
        case 86:
            key[15] = 1;
            break;
    }

}

function emulate() {
    //found this 10-times-trick on https://github.com/alexanderdickson/Chip-8-Emulator/blob/master/scripts/chip8.js
    //makes game faster, why needed? timings or something i guess.
    for(var i=0; i < 10; i++) emulateCycle();
    if (drawFlag) drawGraphics();
    requestAnimationFrame(emulate);
}

function startEmulator() {
    initialize();
    loadGame();
    //not sure if this and the function above is the best way to take keypresses
    window.addEventListener("keydown", handleKeyPress, true);
    window.addEventListener("keyup", function () {key.fill(0)}, true);
    requestAnimationFrame(emulate);
}