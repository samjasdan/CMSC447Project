<?php
get_header();
?>

<main id="main" class="container">
    <?php get_sidebar('tutoring'); ?>

    <div class="main-content">
        <?php
        if ( have_posts() ) :
            while ( have_posts() ) :
                the_post();
                ?>
                <article <?php post_class(); ?>>
                    <header class="entry-header">
                        <h1 class="entry-title"><?php the_title(); ?></h1>
                    </header>

                    <div class="entry-content">
                        <?php the_content(); ?>
                    </div>
                </article>
                <?php
            endwhile;
        else :
            ?>
            <p>No content found.</p>
            <?php
        endif;
        ?>
    </div>
</main>

<?php
get_footer();
?>