'use sctrict';

const core = require('@actions/core');


function comparePlatform(src, dest) {
    return src.os == dest.os && src.architecture == dest.architecture;
}


async function request(url, options) {
    const resp = await fetch(url, options);
    const data = await resp.json();

    if (resp.status >= 400) {
        throw new Error(resp);
    }

    return data;
}


async function getTags({ namespace, repository, tag, platforms=[] }) {
    const token = await getToken(namespace, repository);
    const manifests = await getManifests(namespace, repository, tag);

    return manifests.filter(e => e.platform.architecture !== 'unknown')
                    .filter(e => !platforms.length || platforms.some(p => comparePlatform(p, e.platform)))
                    .map(async e => {
                        const url = `https://registry.hub.docker.com/v2/${namespace}/${repository}/manifests/${e.digest}`;
                        const headers = {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
                        };
                        const data = await request(url, {headers});
                        return {...e, layers: data.layers};
                    });
}


async function getManifests(namespace, repository, tag) {
    const token = await getToken(namespace, repository);
    const url = `https://registry.hub.docker.com/v2/${namespace}/${repository}/manifests/${tag}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json',
    };
    return (await request(url, {headers})).manifests;
}


function getTokenFactory() {
    const cache = {};

    return async (namespace, repository) => {
        const key = `${namespace}/${repository}`;
        let token = cache[key];

        if (token) {
            const issuedAt = new Date(token.issued_at);
            
            if (issuedAt.valueOf() + token.expires_in > Date.now()) {
                return token.access_token;
            }
        }

        const url = new URL('https://auth.docker.io/token');
    
        url.searchParams.append('service', 'registry.docker.io');
        url.searchParams.append('scope', `repository:${namespace}/${repository}:pull`);

        token = cache[key] = await request(url);

        return token.access_token;
    };
}


const getToken = getTokenFactory();


function parseImageName(s) {
    const [name, tag='latest'] = s.split(':');
    const [repository, namespace='library'] = name.split('/').reverse();
    return {namespace, repository, tag};
}


async function main({ baseImage, userImage }) {
    const userImageTags = await Promise.all(
        await getTags(parseImageName(userImage))
    );
    const baseImageTags = await Promise.all(
        await getTags({
            ...parseImageName(baseImage),
            platforms: userImageTags.map(e => e.platform),
        })
    );
    
    const results = baseImageTags.map(b => {
        const { layers } = userImageTags.find(u => comparePlatform(b.platform, u.platform));

        const baseDigest = b.layers.map(e => e.digest);
        const userDigest = layers.splice(0, baseDigest.length).map(e => e.digest);
        
        return userDigest.every((e, i) => e != baseDigest[i]);
    });

    return results.includes(true);
}


async function run() {
    try {
        const baseImage = core.getInput('base-image');
        const userImage = core.getInput('user-image');
        core.setOutput('result', await main({ baseImage, userImage }));
    } catch (err) {
        core.setFailed(err.message);
    }
}


run();
