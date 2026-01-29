const { Client } = require('pg');

const connectionString = 'postgres://pos:xpmfJaybYE5hvzq7JPCAETnheTieqddu@dpg-d5qevrh4tr6s73devvqg-a.singapore-postgres.render.com:5432/pos_dyi7?ssl=true';

async function mergeShops() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to database');

        // 1. Get all shop profiles
        const shopRes = await client.query('SELECT id FROM shop_profile');
        if (shopRes.rows.length <= 1) {
            console.log('Only one shop profile found. No merge needed.');
            return;
        }

        const primaryShopId = shopRes.rows[0].id;
        const otherShopIds = shopRes.rows.slice(1).map(r => r.id);

        console.log(`Primary Shop ID: ${primaryShopId}`);
        console.log(`Redundant Shop IDs: ${otherShopIds.join(', ')}`);

        // 2. Move accounts to primary shop
        const updateRes = await client.query(
            'UPDATE shop_payment_account SET shop_id = $1 WHERE shop_id = ANY($2)',
            [primaryShopId, otherShopIds]
        );
        console.log(`Moved ${updateRes.rowCount} payment accounts to primary shop.`);

        // 3. Delete redundant shop profiles
        const deleteRes = await client.query(
            'DELETE FROM shop_profile WHERE id = ANY($1)',
            [otherShopIds]
        );
        console.log(`Deleted ${deleteRes.rowCount} redundant shop profiles.`);

        // 4. Ensure only one account is active for the primary shop
        const accountsRes = await client.query(
            'SELECT id FROM shop_payment_account WHERE shop_id = $1 AND is_active = true',
            [primaryShopId]
        );
        
        if (accountsRes.rows.length > 1) {
            console.log(`Found ${accountsRes.rows.length} active accounts. Normalising to one...`);
            await client.query(
                'UPDATE shop_payment_account SET is_active = false WHERE shop_id = $1 AND id != $2',
                [primaryShopId, accountsRes.rows[0].id]
            );
            console.log('Normalised active account.');
        }

        console.log('Merge completed successfully.');
    } catch (err) {
        console.error('Error merging shops:', err);
    } finally {
        await client.end();
    }
}

mergeShops();
