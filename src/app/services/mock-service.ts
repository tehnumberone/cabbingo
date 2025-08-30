import { Tile } from "../models/tile";

export class MockService {

    private mockTiles1: Tile[] = [
        {
            id: 1,
            title: 'Draconic Visage',
            src: 'https://oldschool.runescape.wiki/images/thumb/Draconic_visage_detail.png/130px-Draconic_visage_detail.png?6edab',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/King_Black_Dragon.png/290px-King_Black_Dragon.png?d25f0',
            alt: 'Draconic Visage',
            description: 'Obtain a Draconic Visage from a King Black Dragon',
            itemsRequired: 1,
            itemsObtained: 0,
            points:5
        },
        {
            id: 2,
            title: 'Any Scroll',
            src: 'https://oldschool.runescape.wiki/images/thumb/Dexterous_prayer_scroll_detail.png/150px-Dexterous_prayer_scroll_detail.png?d6a6b',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/Great_Olm.png/300px-Great_Olm.png?f1081',
            alt: 'Dex Scroll',
            description: 'Obtain any scroll from the Chamber of Xeric',
            itemsRequired: 1,
            itemsObtained: 1,
            points:5
        },
        {
            id: 3,
            title: 'Any torva piece',
            src: 'https://oldschool.runescape.wiki/images/thumb/Torva_full_helm_detail.png/120px-Torva_full_helm_detail.png?975a0',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/Nex.png/270px-Nex.png?2a1b3',
            alt: 'Torva Helm',
            description: 'Obtain any piece of Torva from Nex',
            itemsRequired: 1,
            itemsObtained: 0,
            points:5
        },
        {
            id: 4,
            title: 'Any megarare',
            src: 'https://oldschool.runescape.wiki/images/thumb/Twisted_bow_detail.png/150px-Twisted_bow_detail.png?7aa10',
            bossSrc: './assets/raids.png',
            alt: 'Twisted Bow',
            description: 'Obtain any megarare drop from any raid',
            itemsRequired: 1,
            itemsObtained: 1,
            points:5
        },
        {
            id: 5,
            title: '5 Venator Shards',
            src: 'https://oldschool.runescape.wiki/images/thumb/Venator_shard_detail.png/130px-Venator_shard_detail.png?3ad3e',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/Phantom_Muspah_%28ranged%29.png/250px-Phantom_Muspah_%28ranged%29.png?9cf6a',
            alt: 'Venator Shard',
            description: 'Obtain 5 Venator Shards from the Phantom Muspah',
            itemsRequired: 5,
            itemsObtained: 1,
            points:5
        },
        {
            id: 6,
            title: 'Ultor Vestige',
            src: 'https://oldschool.runescape.wiki/images/thumb/Ultor_vestige_detail.png/130px-Ultor_vestige_detail.png?99817',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/Vardorvis.png/200px-Vardorvis.png?48af8',
            alt: 'Ultor Vestige',
            description: 'Obtain an Ultor Vestige from Vardorvis',
            itemsRequired: 1,
            itemsObtained: 0,
            points:5
        }
    ];
private mockTiles2: Tile[] = [
        {
            id: 1,
            title: 'Draconic Visage',
            src: 'https://oldschool.runescape.wiki/images/thumb/Draconic_visage_detail.png/130px-Draconic_visage_detail.png?6edab',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/King_Black_Dragon.png/290px-King_Black_Dragon.png?d25f0',
            alt: 'Draconic Visage',
            description: 'Obtain a Draconic Visage from a King Black Dragon',
            itemsRequired: 1,
            itemsObtained: 0,
            points:5
        },
        {
            id: 2,
            title: 'Any Scroll',
            src: 'https://oldschool.runescape.wiki/images/thumb/Dexterous_prayer_scroll_detail.png/150px-Dexterous_prayer_scroll_detail.png?d6a6b',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/Great_Olm.png/300px-Great_Olm.png?f1081',
            alt: 'Dex Scroll',
            description: 'Obtain any scroll from the Chamber of Xeric',
            itemsRequired: 1,
            itemsObtained: 1,
            points:5
        },
        {
            id: 3,
            title: 'Any torva piece',
            src: 'https://oldschool.runescape.wiki/images/thumb/Torva_full_helm_detail.png/120px-Torva_full_helm_detail.png?975a0',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/Nex.png/270px-Nex.png?2a1b3',
            alt: 'Torva Helm',
            description: 'Obtain any piece of Torva from Nex',
            itemsRequired: 1,
            itemsObtained: 0,
            points:5
        },
        {
            id: 4,
            title: 'Any megarare',
            src: 'https://oldschool.runescape.wiki/images/thumb/Twisted_bow_detail.png/150px-Twisted_bow_detail.png?7aa10',
            bossSrc: './assets/raids.png',
            alt: 'Twisted Bow',
            description: 'Obtain any megarare drop from any raid',
            itemsRequired: 1,
            itemsObtained: 1,
            points:5
        },
        {
            id: 5,
            title: '5 Venator Shards',
            src: 'https://oldschool.runescape.wiki/images/thumb/Venator_shard_detail.png/130px-Venator_shard_detail.png?3ad3e',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/Phantom_Muspah_%28ranged%29.png/250px-Phantom_Muspah_%28ranged%29.png?9cf6a',
            alt: 'Venator Shard',
            description: 'Obtain 5 Venator Shards from the Phantom Muspah',
            itemsRequired: 5,
            itemsObtained: 5,
            points:5
        },
        {
            id: 6,
            title: 'Ultor Vestige',
            src: 'https://oldschool.runescape.wiki/images/thumb/Ultor_vestige_detail.png/130px-Ultor_vestige_detail.png?99817',
            bossSrc: 'https://oldschool.runescape.wiki/images/thumb/Vardorvis.png/200px-Vardorvis.png?48af8',
            alt: 'Ultor Vestige',
            description: 'Obtain an Ultor Vestige from Vardorvis',
            itemsRequired: 1,
            itemsObtained: 1,
            points:5
        }
    ];
    board: Tile[][] = [this.mockTiles1, this.mockTiles2];
}