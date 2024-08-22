'use sctrict';


const core = require('@actions/core');
const { main } = require('./checker');


async function run() {
    try {
        const optionsStringToObject = s => Object.fromEntries(
            s.split(',').map(o => o.split('='))
        );

        const baseImage = core.getInput('base-image');
        const userImage = core.getInput('user-image');
        const platforms = core.getMultilineInput('platforms').map(optionsStringToObject);

        console.log('Base image:', baseImage);
        console.log('User image:', userImage);
        console.log('Platforms:', platforms);

        core.setOutput('result', await main({ baseImage, userImage, platforms }));
    } catch (err) {
        core.setFailed(err.message);
    }
}


run();
